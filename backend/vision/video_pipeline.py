"""
Real-video pipeline: YOLOv8m inference via SAHI sliced detection.

SAHI (Slicing Aided Hyper Inference) splits each frame into overlapping tiles
before detection, then merges results. This dramatically improves accuracy in
dense/occluded crowds where standard single-pass inference undercounts badly.

Falls back to plain YOLOv8m (no slicing) if SAHI is not installed.
"""

import threading
import time
import cv2
import numpy as np
from ultralytics import YOLO
from config.store import config_store

try:
    import torch
    from PIL import Image
    from sahi import AutoDetectionModel
    from sahi.predict import get_sliced_prediction
    _SAHI = True
except ImportError:
    _SAHI = False

# ── Zone layout for 640×480 video frame ───────────────────────────────────────
#
#  y=0   ┌──────────────────────────────────────────┐
#        │  CONC (top strip — concourse/entry area)  │
#  y=120 ├──────────────────┬───────────────────────┤
#        │ FOB1 (left FOB)  │  FOB2 (right FOB)     │
#  y=210 ├──────────────────┴───────────────────────┤
#        │  P1 (near/foreground platform section)    │
#  y=300 ├───────────────────────────────────────────┤
#        │  P2 (mid platform section)                │
#  y=390 ├───────────────────────────────────────────┤
#        │  P3 (far/background platform section)     │
#  y=480 └───────────────────────────────────────────┘

_ACTIVE_ZONES = [
    {"id": "CONC", "x1": 0,   "y1": 0,   "x2": 640, "y2": 120, "area_m2": 60.0},
    {"id": "FOB1", "x1": 0,   "y1": 120, "x2": 320, "y2": 210, "area_m2": 15.0},
    {"id": "FOB2", "x1": 320, "y1": 120, "x2": 640, "y2": 210, "area_m2": 15.0},
    {"id": "P1",   "x1": 0,   "y1": 210, "x2": 640, "y2": 300, "area_m2": 40.0},
    {"id": "P2",   "x1": 0,   "y1": 300, "x2": 640, "y2": 390, "area_m2": 40.0},
    {"id": "P3",   "x1": 0,   "y1": 390, "x2": 640, "y2": 480, "area_m2": 40.0},
]
_PASSIVE_ZONES = ["GATE_A", "GATE_B", "GATE_C", "P4", "P5", "P6"]

# Single-zone layout for single-camera footage (platform or aerial):
# entire frame maps to one zone — no artificial y-division
_SINGLE_ACTIVE_ZONES = [
    {"id": "P1", "x1": 0, "y1": 0, "x2": 640, "y2": 480, "area_m2": 80.0},
]
_SINGLE_PASSIVE_ZONES = ["CONC", "GATE_A", "GATE_B", "GATE_C", "FOB1", "FOB2", "P2", "P3", "P4", "P5", "P6"]


def _make_state(zone_id: str, density: float, count: int) -> dict:
    config = config_store.get()
    zone = config.zone_by_id(zone_id)
    return {
        "density": round(density, 2),
        "count": count,
        "color": config.density_color(density),
        "name": zone.label if zone else zone_id,
        "flow_vector": {"dx": 0.0, "dy": 0.0, "magnitude": 0.0},
    }


class VideoPipeline:
    """
    Runs person detection on a looping video file in a daemon thread.

    SAHI (CPU):  YOLOv8m + SAHI with 192px tiles → 2fps, ~15-25 detections
    Plain (CPU): YOLOv8m single-pass             → 5fps, ~5-15 detections
    """

    def __init__(self, video_path: str, fps_target: int | None = None, single_zone: bool = False, use_sahi: bool = False):
        # use_sahi=False: plain YOLOv8m tracking at 5fps → smooth visual boxes
        # use_sahi=True:  SAHI sliced detection at ~1.5fps → better count accuracy
        self._use_sahi = use_sahi and _SAHI
        if fps_target is None:
            fps_target = 2 if self._use_sahi else 5
        self._tile_size = 192
        # single_zone: whole frame → P1; avoids false multi-zone splits for single-camera footage
        self._active_zones  = _SINGLE_ACTIVE_ZONES  if single_zone else _ACTIVE_ZONES
        self._passive_zones = _SINGLE_PASSIVE_ZONES if single_zone else _PASSIVE_ZONES
        self.video_path = video_path
        self._fps_target = fps_target
        self._lock = threading.Lock()
        self._latest_state: dict | None = None
        self._latest_persons: list = []
        self._frame_count = 0
        self._running = False
        self._ema: dict[str, float] = {}
        self._thread: threading.Thread | None = None
        self._start_time = 0.0
        self._detection_model = None
        self._yolo_model: YOLO | None = None

    def start(self):
        self._running = True
        self._start_time = time.monotonic()
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def stop(self):
        self._running = False

    def elapsed(self) -> float:
        return time.monotonic() - self._start_time

    def get_states(self) -> dict | None:
        with self._lock:
            return self._latest_state

    def get_persons(self) -> list:
        with self._lock:
            return list(self._latest_persons)

    # ── Internal ──────────────────────────────────────────────────────────────

    def _load_model(self):
        if self._use_sahi:
            device = "cpu"
            print(f"[JanKavach] Loading YOLOv8m + SAHI on {device}")
            self._detection_model = AutoDetectionModel.from_pretrained(
                model_type="ultralytics",
                model_path="yolov8m.pt",
                confidence_threshold=0.08,
                device=device,
            )
        else:
            print("[JanKavach] Loading YOLOv8m (plain tracking, 5fps)")
            self._yolo_model = YOLO("yolov8m.pt")

    def _run(self):
        try:
            self._load_model()
        except Exception as e:
            print(f"[JanKavach] Model load failed: {e}", flush=True)
            return

        cap = cv2.VideoCapture(self.video_path)
        if not cap.isOpened():
            print(f"[JanKavach] Cannot open video: {self.video_path}", flush=True)
            return

        source_fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        skip = max(1, int(source_fps / self._fps_target))
        frame_idx = 0
        interval = 1.0 / self._fps_target

        print(f"[JanKavach] Pipeline running — {self._fps_target}fps target, skip={skip}, tile={self._tile_size}px", flush=True)

        while self._running:
            t0 = time.monotonic()
            ret, frame = cap.read()
            if not ret:
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                frame_idx = 0
                continue

            if frame_idx % skip == 0:
                frame = cv2.resize(frame, (640, 480))
                try:
                    states, persons = self._infer(frame)
                    with self._lock:
                        self._latest_state = states
                        self._latest_persons = persons
                        self._frame_count += 1
                    if self._frame_count % 20 == 1:
                        total = sum(s["count"] for s in states.values())
                        print(f"[JanKavach] frame={self._frame_count} total_persons={total}", flush=True)
                except Exception as e:
                    print(f"[JanKavach] Inference error frame {frame_idx}: {e}", flush=True)

            frame_idx += 1
            drift = time.monotonic() - t0
            time.sleep(max(0.0, interval - drift))

        cap.release()
        print("[JanKavach] Pipeline stopped.", flush=True)

    def _infer(self, frame: np.ndarray) -> tuple[dict, list]:
        if self._use_sahi and self._detection_model is not None:
            return self._infer_sahi(frame)
        return self._infer_yolo(frame)

    def _infer_sahi(self, frame: np.ndarray) -> tuple[dict, list]:
        pil_frame = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))

        sz = self._tile_size
        result = get_sliced_prediction(
            pil_frame,
            self._detection_model,
            slice_height=sz,
            slice_width=sz,
            overlap_height_ratio=0.3,
            overlap_width_ratio=0.3,
            perform_standard_pred=True,
            postprocess_type="GREEDYNMM",
            postprocess_match_threshold=0.3,
            postprocess_match_metric="IOS",
            verbose=0,
        )

        counts: dict[str, int] = {z["id"]: 0 for z in self._active_zones}
        persons: list[dict] = []
        for obj in result.object_prediction_list:
            if obj.category.name != "person":
                continue
            cx = (obj.bbox.minx + obj.bbox.maxx) / 2
            cy = (obj.bbox.miny + obj.bbox.maxy) / 2
            for z in self._active_zones:
                if z["x1"] <= cx < z["x2"] and z["y1"] <= cy < z["y2"]:
                    counts[z["id"]] += 1
                    break
            persons.append({
                "x1": round(max(0.0, obj.bbox.minx / 640), 3),
                "y1": round(max(0.0, obj.bbox.miny / 480), 3),
                "x2": round(min(1.0, obj.bbox.maxx / 640), 3),
                "y2": round(min(1.0, obj.bbox.maxy / 480), 3),
            })

        return self._counts_to_states(counts), persons

    def _infer_yolo(self, frame: np.ndarray) -> tuple[dict, list]:
        results = self._yolo_model.predict(
            frame,
            classes=[0],
            verbose=False,
            conf=0.25,
            max_det=300,
            iou=0.4,
            device="cpu",  # keep tensors on CPU — torchvision CUDA build not installed
        )

        counts: dict[str, int] = {z["id"]: 0 for z in self._active_zones}
        persons: list[dict] = []
        if results and results[0].boxes is not None:
            xyxy = results[0].boxes.xyxy.cpu().numpy()
            for box in xyxy:
                cx = (float(box[0]) + float(box[2])) / 2
                cy = (float(box[1]) + float(box[3])) / 2
                for z in self._active_zones:
                    if z["x1"] <= cx < z["x2"] and z["y1"] <= cy < z["y2"]:
                        counts[z["id"]] += 1
                        break
                persons.append({
                    "x1": round(max(0.0, float(box[0]) / 640), 3),
                    "y1": round(max(0.0, float(box[1]) / 480), 3),
                    "x2": round(min(1.0, float(box[2]) / 640), 3),
                    "y2": round(min(1.0, float(box[3]) / 480), 3),
                })

        return self._counts_to_states(counts), persons

    def _counts_to_states(self, counts: dict[str, int]) -> dict:
        states: dict = {}
        EMA_ALPHA = 0.75  # high alpha = fast response to density changes

        for z in self._active_zones:
            zid = z["id"]
            raw = counts[zid] / z["area_m2"]
            prev = self._ema.get(zid, raw)
            smooth = EMA_ALPHA * raw + (1 - EMA_ALPHA) * prev
            self._ema[zid] = smooth
            states[zid] = _make_state(zid, smooth, counts[zid])

        for zid in self._passive_zones:
            prev = self._ema.get(zid, 0.4)
            states[zid] = _make_state(zid, prev, 0)

        return states
