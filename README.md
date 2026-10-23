# JanKavach — Crowd Crush Foresight System for Indian Railways

> **See the crowd crush forming 90 seconds before it becomes lethal — and give a human the fastest possible way to act on their own existing authority.**

Built for **hackX 1.0** · Railways Theme · Team AMOGH

---

## The Problem

**18 people died at New Delhi Railway Station on February 15, 2025.**

The station had 200+ cameras and a manned control room. The crowd crush was visible for minutes before it turned lethal. The operators were too slow — not because they were negligent, but because the human decision loop is structurally broken:

| Stage | Time |
|---|---|
| Operator notices anomaly | ~2 min |
| Decision escalated to supervisor | ~1 min |
| Supervisor authorizes response | ~1 min |
| **Total: Human decision loop** | **4+ minutes** |
| **Crowd crush formation window** | **90 seconds** |

The gap is not a training problem. It's a physics problem. Crowd crushes compress faster than human chains can respond.

**Scale of the problem:**
- 145+ stampede deaths per year in India (NCRB, 2001–2022 average)
- 120+ deaths from crowd crush incidents in India in 2025 alone
- Kumbh Mela, Jan 2025: 30 deaths despite 1,800 AI cameras and 400 dedicated operators
- Seoul Itaewon, 2022: 159 deaths — same failure pattern, different country
- Indian Railways is investing ₹150 billion in AI-enabled CCTV — cameras that watch, but still route every decision through a human

Existing solutions (Thales DIVA, Createc, Kumbh's ICCC) detect crowds and alert humans. None found in our research autonomously act. The fatal gap is between detection and action — and it's still open.

---

## The Solution

**JanKavach** replaces the human reaction bottleneck with a **graded foresight-and-response system**. The design principle: anything purely informational and fully reversible executes immediately, on a duty officer's existing standing authority. Anything that changes the physical environment a crowd is moving through — an escalator's direction, a gate's throughput — always waits for an explicit human confirm. **No physical action ever fires without a person approving it.**

| Level | Trigger | Response | Latency | Authority |
|---|---|---|---|---|
| **L1 — Immediate (informational)** | Density ≥ 5.0/m² | PA announcement · dynamic signage | **< 3 seconds** | Fires automatically — zero physical force, fully reversible |
| **L2 — Staged (confirm required)** | Density ≥ 6.0/m² | Escalator direction reversal · gate throughput reduction · RPF deployment request | Human-controlled | Always requires an operator's explicit confirm — never auto-executes |
| **PRE-WARN — Standby alert** | Density ≥ 7.0/m² | Standby notice to RPF · Police · Fire Brigade · Ambulance | **< 3 seconds** | Automatic — notifies more humans, does not act on the crowd |
| **L3 — Human confirm** | Predicted ≥ 7.5/m² in 90s | Platform / station-entry closure | Human-controlled | Supervisor one-tap confirm required |
| **SOS — Failsafe dispatch** | Density ≥ 8.0/m² **and** PRE-WARN already fired | Full emergency dispatch — RPF deployed, Police 100 / Fire 101 / Ambulance 108 called | **< 3 seconds** | Automatic, but hard-gated on a prior PRE-WARN |

**Key guarantee:** SOS cannot fire cold — it only escalates from a zone that has already raised PRE-WARN in the current incident. This is enforced in `engine.py`, not just in the UI, and covered by the backend test suite. No L2/L3 action — anything with a physical effect on the station environment — ever executes without a human confirming it first.

**Prediction:** a deterministic, rule-based crowd-flow model forecasts density 90 seconds ahead — not a black-box ML model. For a trigger that stages physical-world actions, we chose an auditable rule over an opaque one: every prediction traces to the exact density-rate calculation that produced it.

This is **graded autonomous response**, not a fully autonomous system — the same trust model used in aviation autopilot and self-driving cars, where authority is earned level by level, never assumed uniformly.

---

## Live Demo

JanKavach runs in two modes from the same dashboard:

**1. Scripted incident replay (`TRACK VIEW` → `COMPARISON`)**
The demo replays the FOB-3 stairway crowd surge (NDLS, Feb 15 2025) across zones modeled on the station's actual layout — Ajmeri Gate, Paharganj Gate, the FOB-3 stairway serving Platforms 14/15, and Platforms 11–16 — as a split-screen comparison against the documented incident timeline:

- **Human-operated model:** 4 minutes 12 seconds to first response, matching the recorded timeline. Crush event occurs at T+3m08s (as recorded).
- **JanKavach model:** identical input, identical thresholds. L1 fires at T+2.3s.

Use the **MAX LEVEL** toggle to demonstrate any single escalation tier in isolation for judges — `L1` / `L2` / `L3` / `PRE-WARN` / `SOS` — without waiting for the full scenario to escalate there naturally.

**2. Live multi-camera detection (`VIEW` toggle)**
A CCTV-wall style picker lists every video file dropped into `data/videos/` as a live "camera feed." Selecting one runs **real YOLOv8m inference with SAHI tiled slicing** on that footage and shows the raw feed side-by-side with the AI tracking overlay — the decision engine fires on genuinely detected density, not a script.

```
Backend:  http://localhost:8000
Frontend: http://localhost:3000
```

---

## Configurable for Any Station

The demo ships pre-loaded with NDLS's real geometry, but nothing about the engine is hardcoded to it. A **Settings panel** (Zones · Thresholds · Categories · Views) lets an operator redefine the entire station — zone boundaries, per-zone area, category groupings, every density threshold, and which panels the dashboard shows — without touching code, through a validated `PUT /config` endpoint.

The threshold schema enforces its own safety margin: adjacent thresholds must sit at least `0.5/m²` apart, because a validator alone (`l1 < l2 < pre_warn < l3 < failsafe`) doesn't stop someone from setting them close enough together that two levels fire in the same broadcast tick — indistinguishable from the out-of-order "everything at once" failure the escalation ladder exists to prevent.

This turns the FOB-3 scenario from a one-off demo into a template: any station's control room can load its own zone map and thresholds and get the same graded response engine.

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| **Person Detection** | YOLOv8m (Ultralytics) | Best accuracy/speed tradeoff for dense crowds |
| **Tiled Inference** | SAHI (sliced inference) | Detects far more persons per frame than plain YOLO on aerial/wide-angle footage |
| **Object Tracking** | ByteTrack (built into Ultralytics) | Persistent IDs across frames for flow-vector computation |
| **Flow Prediction** | Rule-based crowd flow extrapolation | 90-second density forecast, convergence detection, fully auditable |
| **Decision Engine** | Custom 5-level graded intervention engine | Sequential escalation with the PRE-WARN → SOS guarantee |
| **Station Config** | Pydantic schema + validated store | No-code zones/thresholds/views, backed by 32 backend tests |
| **Backend** | FastAPI + WebSocket (Python) | 200ms broadcast loop, dual-engine (JanKavach vs. Human) comparison |
| **Frontend** | Next.js 14 + Framer Motion | Real-time dashboard, split-screen comparison, live tracking view |
| **Charts** | Recharts | Live per-zone density charts |

### Expansion Technology (Production Path)

| Layer | Technology |
|---|---|
| Camera integration | ONVIF — works with any IP camera already installed at stations |
| Edge inference | NVIDIA Jetson AGX Orin — runs YOLOv8 + SAHI locally |
| Railway integration | CRIS API + NTES — live train schedule → density prediction context |
| Station infrastructure | SCADA + BMS — direct gate, escalator, signage control |
| Passenger systems | IRCTC — push notification to ticket holders in affected zones |
| Emergency dispatch | Police 100 / Fire 101 / Ambulance 108 — validated SMS + CAD APIs |

---

## Engineering Rigor

- **32 backend tests** covering the config schema, config store, decision engine under custom configs, scenario runner, and vision pipeline — `cd backend && pytest`
- **Single source of truth for thresholds** — `constants.py` for the shipped defaults, `config/schema.py` for anything an operator changes at runtime; the decision engine never hardcodes a density number
- **Config validation, not just UI validation** — zone/category references, unique zone IDs, threshold ordering, and minimum threshold gaps are all enforced server-side by Pydantic, so a malformed config can't reach the engine
- **No hardcoded response times** — every "response time" shown in the intervention feed is computed from the system clock at fire time
- **Real inference in live mode** — YOLOv8m + SAHI actually run on the selected video; nothing is mocked or replayed from a cached detection log

---

## Project Structure

```
jankavach/
├── backend/
│   ├── main.py                  # FastAPI + WebSocket server, dual-engine broadcast, live/scenario mode switch
│   ├── constants.py              # Shipped default thresholds (single source of truth)
│   ├── requirements.txt
│   ├── config/
│   │   ├── schema.py             # Pydantic models + validation for zones/thresholds/categories/views
│   │   ├── defaults.py           # NDLS out-of-the-box StationConfig
│   │   └── store.py              # Runtime config store backing GET/PUT /config
│   ├── vision/
│   │   ├── detector.py           # YOLOv8m + SAHI inference
│   │   ├── tracker.py            # ByteTrack wrapper
│   │   ├── zone_map.py           # Zone geometry → density computation
│   │   └── video_pipeline.py     # Live-mode frame pipeline
│   ├── prediction/
│   │   └── extrapolator.py       # 90s rule-based crowd-flow forecasting
│   ├── decision/
│   │   ├── engine.py             # 5-level graded intervention engine, PRE-WARN → SOS gate
│   │   └── interventions.py      # Level definitions, action strings
│   ├── demo/
│   │   └── scenario_runner.py    # Scripted FOB-3 keyframe scenario
│   └── tests/                    # 32 tests across config, engine, scenario, vision
├── frontend/
│   ├── app/
│   │   ├── page.tsx              # Main dashboard, mode switching, demo controls
│   │   └── layout.tsx
│   ├── components/
│   │   ├── SplitScreen.tsx           # Human vs. JanKavach comparison panel
│   │   ├── VideoTrackingView.tsx     # Raw feed + AI tracking overlay (live mode)
│   │   ├── VideoSourcePicker.tsx     # CCTV-wall multi-camera source picker
│   │   ├── InterventionFeed.tsx      # Chronological event log
│   │   ├── ThresholdConfirmCard.tsx  # Unified L2/L3 confirm/cancel card
│   │   ├── StationMap.tsx            # Zone density heatmap
│   │   ├── ZoneChart.tsx             # Live density chart
│   │   ├── EmergencyOverlay.tsx      # SOS full-screen dispatch UI
│   │   ├── PreWarnBanner.tsx         # PRE-WARN amber banner
│   │   ├── RPFAlert.tsx              # RPF notification card
│   │   ├── PAAnnouncementBanner.tsx
│   │   ├── PhoneNotification.tsx
│   │   ├── SettingsPanel.tsx         # Zones / Thresholds / Categories / Views editor
│   │   └── settings/                 # Per-tab settings editors
│   └── lib/
│       ├── websocket.ts          # WebSocket client, reconnect logic
│       ├── config-context.tsx    # Station config provider, wires config → whole app
│       ├── types.ts              # LiveUpdate, Intervention, StationConfig types
│       └── constants.ts          # Level colors, zone metadata
├── data/
│   └── videos/                   # Stock footage — CCTV-wall sources for live mode
├── PRD.md                        # Full product requirements
├── APP_FLOW.md                   # System architecture and data flow
└── AGENT_RULES.md                # Grounding rules — statistics, autonomy claims, demo integrity
```

---

## Setup

### Prerequisites
- Python 3.10+
- Node.js 18+

### 1. Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

The YOLOv8m model (`yolov8m.pt`) downloads automatically on first run via `ultralytics` if not already present.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 3. Run the scripted demo

Click **▶ START DEMO** in the top bar, then switch to **COMPARISON** to see the split-screen view.

The demo runs at 2× speed — the full 5-minute scenario completes in ~2.5 minutes.

```bash
# Start programmatically
curl -X POST "http://localhost:8000/demo/start"

# Run a specific level only (e.g. PRE-WARN and below)
curl -X POST "http://localhost:8000/demo/set_level/4"
```

### 4. Try live detection

Click the **VIEW** toggle to open the camera picker, then select any source under `data/videos/` to run real YOLOv8m + SAHI inference on it.

### 5. Reconfigure the station

Open **Settings** to edit zones, thresholds, categories, or the dashboard layout. Changes validate server-side and take effect immediately — no restart required.

### 6. Run the backend test suite

```bash
cd backend
pytest
```

---

## API Reference

| Endpoint | Purpose |
|---|---|
| `WS /ws/live` | 200ms broadcast of zone states, predictions, and interventions |
| `POST /demo/start` · `/demo/reset` · `/demo/set_level/{level}` | Control the scripted scenario |
| `POST /live/start` · `/live/stop` · `GET /live/sources` | Switch to real-video detection mode |
| `POST /intervention/{id}/confirm` · `/intervention/{id}/cancel` | Resolve a staged L2/L3 intervention |
| `GET /config` · `PUT /config` · `POST /config/reset` | Read, update, or reset the station configuration |
| `GET /config/thresholds/defaults` | The NDLS out-of-the-box threshold values |

---

## Density Thresholds Reference

```
Color bands:   0–3.0 /m² green   3.0–5.0 /m² amber   5.0–6.0 /m² red   6.0+ /m² critical

Trigger ladder:
5.0 /m²  → L1 AUTO       PA announcement, signage
6.0 /m²  → L2 STAGED     Escalator reversal, gate throttle (confirm required)
7.0 /m²  → PRE-WARN      Standby alert (RPF / Police / Fire / Ambulance)
7.5 /m²  → L3 CONFIRM    Platform closure (human required)
8.0 /m²  → SOS           Emergency dispatch (requires PRE-WARN first)
```

These are the shipped NDLS defaults — every value is editable per-station in **Settings**.

---

## Data & Simulation Disclaimer

**This is a proof-of-concept demonstration. It is not connected to, endorsed by, or deployed at any railway station.**

- The demo scenario is a scripted simulation of crowd density patterns — not live camera data
- Live-mode video sources are publicly available stock footage, labeled generically (`CAM 01`, `CAM 02`, …) rather than as real station cameras
- Person detection models were validated against the **ShanghaiTech Part A crowd density dataset** (1,198 images, 330K annotations); not trained on live Indian Railways footage
- All statistics cited (death tolls, response times, investment figures) are sourced from NCRB reports, official post-incident investigations, and published news records
- Emergency service dispatch shown in the SOS overlay is **simulated** — no real calls or messages are sent
- Zone names and station geometry (NDLS platforms, FOB-1/2/3, Ajmeri/Paharganj gates) reflect the real incident's public reporting; this system has no connection to Indian Railways or RailTel infrastructure

---

*JanKavach — Predict. Respond. Prevent.*
