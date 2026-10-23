"""
JanKavach — FastAPI backend

Two operating modes:
  scenario  — scripted keyframe demo (default); runs the CrowdGuard vs. Human comparison
  video     — real YOLOv8 inference on uploaded footage; decision engine fires on live density

WebSocket /ws/live  → 200ms broadcast of zone states, predictions, interventions
REST       /demo/*  → start / reset scenario
REST       /live/*  → start / stop real-video mode
REST       /intervention/* → confirm / cancel staged interventions
"""

import asyncio
import json
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal
from urllib.parse import quote

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from constants import WEBSOCKET_INTERVAL_MS
from decision.engine import DecisionEngine
from config.store import config_store
from config.schema import StationConfigInput
from config.defaults import DEFAULT_CONFIG
from prediction.extrapolator import Extrapolator
from vision.video_pipeline import VideoPipeline
from demo.scenario_runner import (
    ScenarioRunner, get_frame, L1_FIRE_TIME, CRUSH_TIME_HUMAN, HUMAN_RESPONSE_TIME,
    SCENARIO_DURATION,
)

# ── Video file paths ─────────────────────────────────────────────────────────
_VIDEO_DIR = Path(__file__).parent.parent / "data" / "videos"
_VIDEO_EXTS = {".mp4", ".webm", ".mov", ".avi", ".mkv"}


def _discover_sources() -> dict[str, Path]:
    """All video files under data/videos, keyed by filename stem.

    Re-scanned on every call (not cached) so dropping a new file into the
    folder makes it selectable without restarting the backend.
    """
    if not _VIDEO_DIR.exists():
        return {}
    return {
        p.stem: p
        for p in sorted(_VIDEO_DIR.iterdir())
        if p.is_file() and p.suffix.lower() in _VIDEO_EXTS
    }

# ── Global state ─────────────────────────────────────────────────────────────
mode: Literal["scenario", "video"] = "scenario"
pipeline: VideoPipeline | None = None
# The scenario clock only advances once a client has explicitly hit "START DEMO" —
# without this gate, the always-on broadcast_loop lazily starts ScenarioRunner's
# clock at server boot, so the whole scripted incident (including SOS failsafe)
# auto-plays in the background before anyone asks for it.
demo_running: bool = False

engine_cg    = DecisionEngine()
engine_human = DecisionEngine()
extrapolator = Extrapolator()
scenario     = ScenarioRunner(speed=1.0)

all_interventions: list[dict] = []
connections:       list[WebSocket] = []

# Rolling density history for the extrapolator (30 frames ≈ 6 seconds at 5fps)
_MAX_HIST = 30
_density_hist: dict[str, list[float]] = {}


def _update_hist(zone_states: dict):
    for zid, state in zone_states.items():
        buf = _density_hist.get(zid, [])
        buf.append(state["density"])
        _density_hist[zid] = buf[-_MAX_HIST:]


def _do_reset(speed: float = 1.0, max_level: int = 5):
    """Shared reset logic for demo_start and demo_reset."""
    global mode
    mode = "scenario"
    scenario.set_speed(speed)
    scenario.reset()
    engine_cg.set_max_level(max_level)
    engine_human.set_max_level(max_level)
    engine_cg.reset()
    engine_human.reset()
    all_interventions.clear()
    for buf in _density_hist.values():
        buf.clear()


# ── App setup ────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    asyncio.create_task(broadcast_loop())
    yield

app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded video files for the browser video player
if _VIDEO_DIR.exists():
    app.mount("/videos", StaticFiles(directory=str(_VIDEO_DIR)), name="videos")


# ── WebSocket ────────────────────────────────────────────────────────────────
@app.websocket("/ws/live")
async def websocket_live(ws: WebSocket):
    await ws.accept()
    connections.append(ws)
    try:
        while True:
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        if ws in connections:
            connections.remove(ws)


# ── Scenario (demo comparison) endpoints ─────────────────────────────────────
@app.post("/demo/start")
async def demo_start(speed: float = 1.0, max_level: int = 5):
    global pipeline, demo_running
    if pipeline:
        pipeline.stop()
        pipeline = None
    _do_reset(speed, max_level)
    demo_running = True
    return {"status": "started", "mode": "scenario", "speed": speed, "max_level": max_level}


@app.post("/demo/reset")
async def demo_reset():
    global demo_running
    demo_running = False
    _do_reset()
    return {"status": "reset"}


@app.post("/demo/set_level/{level}")
async def demo_set_level(level: int):
    """Change the max intervention level mid-demo and restart the scenario."""
    global demo_running
    if level < 1 or level > 5:
        return {"status": "error", "detail": "level must be 1–5"}
    _do_reset(max_level=level)
    demo_running = True
    return {"status": "restarted", "max_level": level}


# ── Live video endpoints ──────────────────────────────────────────────────────
@app.post("/live/start")
async def live_start(source: str):
    """Switch to real-video mode, running detection on the given source key
    (one of the keys returned by GET /live/sources)."""
    global mode, pipeline

    video_path = _discover_sources().get(source)
    if not video_path:
        return {"status": "error", "detail": f"Video not found: {source}"}

    if pipeline:
        pipeline.stop()

    engine_cg.reset()
    engine_human.reset()
    all_interventions.clear()
    for buf in _density_hist.values():
        buf.clear()

    pipeline = VideoPipeline(str(video_path), single_zone=True, use_sahi=True)  # SAHI sliced detection for dense crowds
    pipeline.start()
    mode = "video"
    return {"status": "started", "mode": "video", "source": source}


@app.post("/live/stop")
async def live_stop():
    global mode, pipeline
    if pipeline:
        pipeline.stop()
        pipeline = None
    mode = "scenario"
    return {"status": "stopped"}


@app.get("/live/sources")
async def live_sources():
    """List every discovered video file as a selectable camera source, in the
    CCTV-style 'CAM 01' labeling the console uses elsewhere — the real
    filenames are meaningless stock-footage IDs, not station names."""
    sources = _discover_sources()
    return {
        "sources": [
            {"key": key, "label": f"CAM {i + 1:02d}", "url": f"/videos/{quote(path.name)}"}
            for i, (key, path) in enumerate(sources.items())
        ]
    }


# ── Intervention endpoints ────────────────────────────────────────────────────
@app.post("/intervention/{iv_id}/confirm")
async def confirm(iv_id: str):
    ok_cg    = engine_cg.confirm(iv_id)
    ok_human = engine_human.confirm(iv_id)
    ok = ok_cg or ok_human
    if ok:
        for iv_dict in all_interventions:
            if iv_dict["id"] == iv_id:
                iv_dict["status"] = "confirmed"
                break
    return {"status": "confirmed" if ok else "not_found"}


@app.post("/intervention/{iv_id}/cancel")
async def cancel(iv_id: str):
    ok_cg    = engine_cg.cancel(iv_id)
    ok_human = engine_human.cancel(iv_id)
    ok = ok_cg or ok_human
    if ok:
        for iv_dict in all_interventions:
            if iv_dict["id"] == iv_id:
                iv_dict["status"] = "cancelled"
                break
    return {"status": "cancelled" if ok else "not_found"}


# ── Station configuration endpoints ───────────────────────────────────────────
@app.get("/config")
async def get_config():
    return config_store.get()


@app.get("/config/thresholds/defaults")
async def get_default_thresholds():
    """The NDLS out-of-the-box threshold values — what "Reset to default" restores,
    without touching zones/categories/view the way a full /config/reset would."""
    return DEFAULT_CONFIG.thresholds


@app.put("/config")
async def update_config(body: StationConfigInput):
    return config_store.update(body)


@app.post("/config/reset")
async def reset_config():
    return config_store.reset()


# ── Broadcast loop ────────────────────────────────────────────────────────────
async def broadcast_loop():
    while True:
        await asyncio.sleep(WEBSOCKET_INTERVAL_MS / 1000)
        try:
            await _broadcast_tick()
        except Exception as e:
            print(f"[JanKavach] broadcast_loop error: {e}", flush=True)


async def _broadcast_tick():
    global demo_running
    if mode == "video" and pipeline is not None:
        zone_cg = pipeline.get_states()
        if zone_cg is None:
            # Model still loading — send heartbeat so frontend shows spinner
            lp = json.dumps({"video_ready": False, "persons": [], "loading": True})
            for ws in connections[:]:
                try:
                    await ws.send_text(lp)
                except Exception:
                    pass
            return

        elapsed = pipeline.elapsed()
        persons = pipeline.get_persons()
        _update_hist(zone_cg)
        predictions = extrapolator.predict(zone_cg, _density_hist)

        for iv in engine_cg.evaluate(zone_cg, predictions):
            all_interventions.append({**iv.to_dict(), "side": "crowdguard"})

        payload = {
            "elapsed": round(elapsed, 1),
            "config_version": config_store.get().version,
            "crowdguard": {
                "zones": zone_cg,
                "predictions": predictions,
                "l1_fired": any(iv["level"] == 1 for iv in all_interventions),
            },
            "human": {
                "zones": zone_cg,
                "crush_occurred": False,
                "human_responded": False,
            },
            "interventions": all_interventions[-40:],
            "staged": [iv.to_dict() for iv in engine_cg.get_staged()],
            "system_status": _system_status(zone_cg),
            "persons": persons,
            "video_ready": True,
        }

    else:
        # Scenario mode — clock stays parked at T=0 (baseline, no interventions)
        # until /demo/start flips demo_running, so an idle server never auto-plays
        # the incident timeline for a client that hasn't asked for the demo yet.
        elapsed = scenario.elapsed() if demo_running else 0.0
        if demo_running and elapsed >= SCENARIO_DURATION:
            # The scripted incident has played out — park back at idle rather than
            # leaving demo_running on forever. Without this, a run left open just
            # keeps ticking past its own story (elapsed climbing into the thousands
            # of seconds), and anyone who connects later — a new tab, a reload —
            # lands mid-"replay" of a run that actually finished long ago, with
            # every intervention it ever fired dumped on them at once: it looks like
            # the whole incident (through SOS) just happened in an instant, and like
            # nobody had to press "start" for it.
            demo_running = False
            scenario.reset()
            engine_cg.reset()
            engine_human.reset()
            all_interventions.clear()
            for buf in _density_hist.values():
                buf.clear()
            elapsed = 0.0
        zone_cg    = get_frame(elapsed, mode="crowdguard")
        zone_human = get_frame(elapsed, mode="human")

        _update_hist(zone_cg)
        predictions = extrapolator.predict(zone_cg, _density_hist)

        for iv in engine_cg.evaluate(zone_cg, predictions):
            all_interventions.append({**iv.to_dict(), "side": "crowdguard"})
        # engine_human is evaluated only to keep its confirm()/cancel() routing and
        # reset() lifecycle consistent — its own fired/staged interventions are
        # deliberately NOT merged into all_interventions. The split-screen "human"
        # panel already derives its story from elapsed alone (crush_occurred,
        # human_responded above), and the Contact Log has no per-side view: every
        # human-engine event was appearing there as an apparent duplicate of the
        # CrowdGuard event already logged for the same zone/level — e.g. a zone's
        # L1 firing once for CrowdGuard early on, then "again" once elapsed passes
        # HUMAN_RESPONSE_TIME and the human engine independently crosses the same
        # threshold on its own (much higher, un-intervened) density curve.
        if elapsed >= HUMAN_RESPONSE_TIME:
            engine_human.evaluate(zone_human, {})

        payload = {
            "elapsed": round(elapsed, 1),
            "config_version": config_store.get().version,
            "crowdguard": {
                "zones": zone_cg,
                "predictions": predictions,
                "l1_fired": elapsed >= L1_FIRE_TIME,
            },
            "human": {
                "zones": zone_human,
                "crush_occurred": elapsed >= CRUSH_TIME_HUMAN,
                "human_responded": elapsed >= HUMAN_RESPONSE_TIME,
            },
            "interventions": all_interventions[-40:],
            "staged": [iv.to_dict() for iv in engine_cg.get_staged()],
            "system_status": _system_status(zone_cg),
            "persons": [],
            "video_ready": False,
            "demo_running": demo_running,
        }

    dead = []
    for ws in connections[:]:
        try:
            await ws.send_json(payload)
        except Exception:
            dead.append(ws)
    for ws in dead:
        if ws in connections:
            connections.remove(ws)


def _system_status(zones: dict) -> str:
    if not zones:
        return "normal"
    t = config_store.get().thresholds
    max_d = max(z["density"] for z in zones.values())
    if max_d >= t.density_critical:
        return "critical"
    if max_d >= t.l1_trigger:
        return "active"
    if max_d >= t.density_warning:
        return "monitoring"
    return "normal"
