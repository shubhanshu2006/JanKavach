# JanKavach — Product Requirements Document
## hackX 1.0 | Railways Theme

**Version:** 1.3  
**Date:** 23 october, 2026  
**Status:** ACTIVE — Build Reference  
**Demo is the primary deliverable. Every decision serves the demo.**

### v1.3 Changes — PRE_WARN + SOS Failsafe Escalation
Added Level 4 (PRE_WARN) and Level 5 (SOS) to the graded autonomy chain. PRE_WARN auto-fires at density ≥ 7.0/m² (standby alert to all emergency services). SOS auto-fires at density ≥ 8.0/m² only after PRE_WARN has already fired for that zone (full emergency dispatch: RPF, Police 100, Fire 101, Ambulance 108). Frontend: amber PreWarnBanner and full-screen pulsing EmergencyOverlay.

### v1.2 Changes — Visual Animation Layer
Added F7–F12: PA announcement banner, escalator direction animation, gate closure animation, RPF booth alert with expanding rings, phone notification popup, and background crowd video player.

---

## Table of Contents

1. [Product Vision](#1-product-vision)
2. [Problem Statement](#2-problem-statement)
3. [Target Users](#3-target-users)
4. [Core Hypothesis](#4-core-hypothesis)
5. [Feature Specifications](#5-feature-specifications)
6. [Demo Architecture](#6-demo-architecture--the-primary-deliverable)
7. [Technical Architecture](#7-technical-architecture)
8. [Data Strategy](#8-data-strategy)
9. [UI/UX Specifications](#9-uiux-specifications)
10. [API Specifications](#10-api-specifications)
11. [48-Hour Build Plan](#11-48-hour-build-plan)
12. [Acceptance Criteria](#12-acceptance-criteria)
13. [Risk Register](#13-risk-register)
14. [Presentation Structure](#14-presentation-structure)
15. [Grounding Rules](#15-grounding-rules--hallucination-prevention)

---

## 1. Product Vision

**One-line:** Predict dangerous crowd formations 90 seconds before they become lethal — and autonomously respond before a human can pick up the phone.

**The core argument:**  
Every major stampede of the last decade had the same failure: humans were too slow. Not uninformed — too slow. JanKavach removes human latency from first-response by deploying a graded autonomous intervention engine directly on top of existing camera infrastructure.

**What we are NOT building:**  
- A surveillance platform (we do not identify individuals)  
- A monitoring dashboard that alerts humans (that already exists and fails)  
- A fully autonomous gate-control system (safety certification required — not a hackathon deliverable)

**What we ARE building:**  
A prediction-first, action-capable system that:
1. Forecasts crowd crush formation 90 seconds ahead using flow vector modeling
2. Autonomously fires Level 1 interventions (PA, signage, escalator direction)
3. Pre-stages Level 2/3 decisions so human confirm time drops from 4 minutes to 10 seconds
4. Shows the comparison — what happens with and without autonomous response

---

## 2. Problem Statement

> *"18 people died at New Delhi Railway Station on February 15, 2025. Official investigation found the cause: conflicting PA announcements sent a crowd of pilgrims surging between platforms. The system in place: 200+ cameras feeding human operators in a control room. They saw it building. They were too slow."*

### Validated Facts (Do Not Alter)

| Fact | Source | Do Not Exaggerate |
|---|---|---|
| 18 deaths at New Delhi station, Feb 15, 2025 | Wikipedia / Business Standard | Confirmed. Use exactly "18 deaths." |
| 30 deaths at Kumbh Mela stampede, Jan 29, 2025 | Insights IAS | Confirmed. Use exactly "30 deaths." |
| 120+ deaths from stampedes in India in 2025 | The Federal | Use "120+" not "hundreds." |
| 145 average annual stampede deaths India, 2001–2022 | NCRB data | Use "approximately 145 per year." |
| 159 deaths, Seoul Itaewon, Oct 29, 2022 | Wikipedia / PMC | Confirmed. Use exactly "159 deaths." |
| Indian Railways: 6.9B passengers FY2024 | Ministry of Railways | Use "6.9 billion." Do not round to "7 billion." |
| ₹150 billion AI CCTV investment by Indian Railways | Indian Infrastructure | Confirmed. |
| YOLOv8 crowd detection: 95.3% accuracy, 28 FPS | IRO Journals research | Use these numbers. Do not inflate. |
| Crowd crush warning window: 8–15 minutes | Northeastern University research | Use "8–15 minutes." |
| Zero deployed systems with autonomous intervention | Comprehensive competitor research | Confirmed. Maintain this claim carefully — it means no PUBLIC commercial product. |
| Thales DIVA acquired by Hitachi Rail, May 2024 | Thales Group | Use this for competitor context. |

---

## 3. Target Users

### Primary (Demo Focus)
**Railway Station Control Room Operator**
- Role: Monitors camera feeds, coordinates with RPF, manages platform congestion
- Current tool: Live CCTV on multi-monitor wall, radio/phone to issue orders
- Pain: Watching 7–15 screens simultaneously during peak hours, decision deferred to supervisors
- What JanKavach gives them: Pre-staged decisions, one-tap confirm, confidence that L1 is already handled

### Secondary (Decision Maker — Who Buys)
**Railway Ministry / RailTel Technology Head**
- Cares about: Post-Delhi 2025 compliance with Delhi High Court order, budget fit within ₹150B camera project
- What they see in the pitch: ROI (prevention cost vs. compensation + legal), integration with existing RailTel infrastructure

### Tertiary (Global Expansion)
**Metro Rail Corporations, Event Venue Operators, Pilgrimage Site Administrators**
- Same problem, same solution, different deployment context

---

## 4. Core Hypothesis

**If** we can forecast crowd crush formation 90 seconds ahead using real-time flow vector prediction,  
**And** autonomously trigger Level 1 physical interventions (PA, signage, escalator) within 3 seconds of threshold breach,  
**Then** the intervention window (currently missed by human operators who take 4+ minutes) becomes actionable,  
**And** we can demonstrate this gap quantitatively in a live demo.

**Falsifiable test:** Demo must show a simulated crowd scenario where:
- Autonomous system intervenes at t=45s
- Human-operated system would intervene at t=4m+
- Crush threshold is crossed at t=3m08s
- Human-operated scenario results in crush; autonomous scenario prevents it

---

## 5. Feature Specifications

### F1 — Real-Time Crowd Density Heatmap

**Description:** YOLOv8-based person detection on video input. Each detected person is assigned to a zone. Zone density is displayed as a color-coded heatmap overlaid on a station layout SVG.

**Inputs:** Video file (pre-recorded or webcam) fed through YOLOv8  
**Outputs:** Per-zone density count, color classification, heatmap render

**Density Classification:**
```
Green  (Safe):     0–3 persons/m²     — no action
Amber  (Warning):  3–5 persons/m²     — monitor
Red    (Critical): 5–6 persons/m²     — L1 auto-fire
Black  (Lethal):   6+ persons/m²      — L2/L3 stage
```

**Acceptance Criteria:**
- [ ] YOLOv8 model runs real inference (not mocked/hardcoded)
- [ ] Heatmap updates at minimum 3 FPS during demo
- [ ] Zone boundaries visible on station layout SVG
- [ ] Color transitions are smooth (not jarring)
- [ ] Person count visible per zone

---

### F2 — 90-Second Flow Vector Prediction

**Description:** The core innovation. Track crowd movement direction and speed per zone using optical flow or centroid tracking. Feed into LSTM sequence model to predict density state 30/60/90 seconds ahead. Display predicted density on the station map as a "future state" overlay.

**Why this matters:** Detection is solved. Prediction is not. This is what differentiates JanKavach from every competitor.

**Inputs:** Historical density sequence (last 30 seconds of per-zone density counts)  
**Outputs:** Predicted density state at t+30s, t+60s, t+90s per zone

**Technical approach:**
- Option A (Full): Train LSTM on public crowd density sequences (ShanghaiTech dataset temporal data)
- Option B (Hackathon viable): Pre-fitted LSTM on synthetic generated sequences; fine-tune on demo data
- Option C (Minimum viable): Rule-based extrapolation from last 10 frames trend + flow vectors

**For hackathon: Use Option B or C. Do not claim it is fully trained on real Indian station data.**

**Acceptance Criteria:**
- [ ] System displays "Predicted state in 90 seconds" on the station map
- [ ] Prediction updates every 10 seconds
- [ ] UI clearly labels predictions as predictions (not current state)
- [ ] At least one scenario where prediction fires before detection threshold crossed

---

### F3 — Graded Autonomous Intervention Engine

**Description:** Decision engine that maps density state → intervention level → action. Critically: L1 fires without human approval; L2 fires with 10-second cancel window; L3 requires explicit tap.

**Intervention Levels:**

#### Level 1 — Autonomous (fires immediately, no human required)
| Trigger | Action |
|---|---|
| Zone density crosses Red threshold | PA announcement: "Please use alternate exit / Platform 3 is congested, please proceed to Platform 5" |
| Convergent flow vectors detected (two crowds approaching same chokepoint) | Escalator direction flip in simulation |
| Platform density above 80% capacity | Dynamic signage update (displayed in UI) |

**These actions CANNOT make things physically worse.** They redirect, they slow flow, they inform. Safety justification is built in.

#### Level 2 — Assisted (fires in 10 seconds unless human cancels)
| Trigger | Action |
|---|---|
| Zone density crosses Black threshold | Stage gate reduction (shows 10-second countdown in UI; human can cancel) |
| Multiple zones simultaneously at Red | RPF deployment request auto-generated |

#### Level 3 — Human-Confirm Required (staged, one-tap)
| Trigger | Action |
|---|---|
| Predicted crush convergence in <60s | Full platform closure — requires explicit tap, but all details pre-filled |

#### Level 4 — PRE_WARN — Autonomous Standby Alert (density ≥ 7.0/m²)
| Trigger | Action |
|---|---|
| Zone density ≥ 7.0/m² | Standby alert auto-dispatched — RPF, Police, Fire Brigade & Ambulance placed on standby |

**Design intent:** This fires BEFORE the lethal threshold. Emergency services are notified to prepare while JanKavach's L1/L2/L3 interventions are still attempting to bring density down. If they succeed, services stand down. If they fail, services are already staged when SOS fires.

**UI:** Amber slide-down banner: "PRE-WARN ACTIVE — Emergency services on standby for [Zone]"

#### Level 5 — SOS — Autonomous Failsafe (density ≥ 8.0/m² + PRE_WARN already fired)
| Trigger | Action |
|---|---|
| Zone density ≥ 8.0/m² (lethal) AND PRE_WARN already fired for that zone | Full emergency dispatch: RPF deployed, Police 100 called, Fire Brigade 101 dispatched, Ambulance 108 requested |

**Design intent:** The sequential guarantee — SOS cannot fire cold. PRE_WARN must have already been issued for the same zone. This eliminates the risk of accidental SOS from a single bad sensor reading. Two independent density readings above threshold before full emergency activation.

**UI:** Full-screen pulsing red overlay with four service confirmation rows. Operator must acknowledge to dismiss.

**AGENT_RULES constraint:** SOS is autonomous but NEVER fires without a prior PRE_WARN for the same zone. This constraint is enforced in engine.py via `_pre_warn_zones` set check and MUST NOT be removed.

**Acceptance Criteria:**
- [ ] L1 interventions fire automatically with no human input
- [ ] L1 fires within 3 seconds of threshold breach
- [ ] L2 shows countdown timer; cancellable
- [ ] L3 shows pre-filled decision card; single confirm button
- [ ] PRE_WARN fires when zone density ≥ 7.0/m², no human action required
- [ ] PRE_WARN amber banner appears at top of dashboard
- [ ] SOS fires when zone density ≥ 8.0/m² AND PRE_WARN has already fired for that zone
- [ ] SOS full-screen red overlay appears with all four service dispatch rows
- [ ] SOS overlay dismissable by operator after acknowledgement
- [ ] All interventions (L1–SOS) logged with timestamp in intervention feed
- [ ] UI clearly shows which level each intervention is (PRE-WARN tag, SOS tag)

---

### F4 — Intervention Feed (Real-Time Action Log)

**Description:** Scrolling feed showing every system action, with timestamp, zone, trigger reason, intervention level, and action taken. Critical for the demo — judges need to SEE the autonomous decisions happening.

**Format per entry:**
```
[14:32:05] 🔴 L1 AUTO | Zone: Platform 3 | Density: 5.8/m² | 
           ACTION: PA-01 Issued — "Platform 3 congested. Please proceed to Platform 5."
           Response time: 2.3 seconds

[14:32:07] 🟡 L2 STAGED | Zone: FOB-3 | Convergence detected | 
           ACTION: Gate-B reduction staged. Cancelling in 10s unless overridden.
           [CANCEL] [CONFIRM NOW]
```

**Acceptance Criteria:**
- [ ] Feed auto-scrolls to latest entry
- [ ] Color-coded by intervention level (green L1, amber L2, red L3)
- [ ] Timestamp is accurate
- [ ] Shows response time (seconds from trigger to action)
- [ ] Does not show more than 50 entries without pagination

---

### F5 — Split-Screen Demo Mode (MANDATORY FOR DEMO)

**Description:** Side-by-side view comparing JanKavach response vs. human-operated response on the same input scenario. This is the killer demo moment that makes the value proposition undeniable.

**Left panel: Human-Operated Station**
- Same video input
- No autonomous interventions
- Shows "Waiting for operator..." state
- Operator response simulated at t=4m12s (realistic based on research)
- Crowd crush icon appears at t=3m08s

**Right panel: JanKavach**
- Autonomous interventions firing from t=45s
- Crowd never reaches crush density
- Response time counters visible

**Bottom bar:**
```
Human Response Time: 4 minutes 12 seconds    |    JanKavach Response Time: 2.3 seconds
Crush occurred: YES                           |    Crush prevented: YES
```

**Acceptance Criteria:**
- [ ] Both panels run on identical input data (same video, same timestamps)
- [ ] Left panel shows "no action" state until human response time (4m12s)
- [ ] Right panel shows L1 firing at detection threshold
- [ ] Bottom bar statistics update in real-time
- [ ] Visually dramatic and clear — judges must understand without narration

---

### F6 — Station Overview Dashboard

**Description:** Main dashboard view. Bird's-eye station layout SVG with live overlays. Navigation between demo views.

**Components:**
- Station layout SVG (custom drawn, stylized, represents a generic major Indian railway station)
- Density heatmap layer
- Flow vector arrows (animated)
- Zone labels (Platform 1–6, FOB-1, FOB-2, Gate A/B/C)
- Status bar (time, active incidents, system status)
- Right sidebar: Intervention feed
- Bottom: Zone-by-zone density chart (time series, last 60 seconds)

---

### F7 — PA Announcement Banner

When L1 PA fires: a banner slides up from the bottom of the screen. Shows an animated speaker icon with pulsing sound-wave rings. The announcement text scrolls across as a ticker. Auto-dismisses after 6 seconds. Color: amber border, dark background.

**Trigger:** Any L1 intervention with "PA" in the action string.  
**Audio:** Optional — plays a pre-recorded PA audio clip if `public/audio/pa-announcement.mp3` exists.

---

### F8 — Escalator Direction Animation

Two escalators (ESC-1 between FOB-1 and Platform 1/2, ESC-2 between FOB-2 and Platform 4/5) shown as animated SVG elements on the station map. Each has moving steps and a direction arrow. When an L1 escalator intervention fires, the arrow flips with a smooth 180° rotation animation and steps reverse direction. Color changes from green (normal) to amber (reversed for crowd control).

**States:** `up` | `down` (reversed for crowd control) | `stopped`

---

### F9 — Gate Closure Animation

Each gate (Gate A, B, C) shows two animated bars. Normally bars are retracted (gate open — green). When L3 is confirmed for a gate zone, the bars slide inward from both sides with a smooth animation, meeting in the center. Gate zone turns red and shows "CLOSED" label. A separate indicator in the intervention feed confirms the action.

**States:** `open` | `closing` (animation in progress) | `closed` | `restricted` (L2 — partial)

---

### F10 — RPF Booth Alert

When an L2 RPF deployment intervention fires, a widget appears in the right sidebar showing an RPF booth icon with three expanding concentric ring animations (radar/sonar effect). A distance label shows "BOOTH-3 — 120m". Rings pulse in red. The alert persists until manually dismissed or scenario resets.

---

### F11 — Phone Notification Popup

When the RPF alert fires (L2) or a critical L3 intervention is staged: a simulated smartphone mockup slides in from the bottom-right corner. The phone shows a notification card with JanKavach logo, alert message, zone, timestamp, and action. After 8 seconds the phone slides back out. Represents the real-world alert that would be sent to RPF officers' devices.

**Notification format:**  
```
🚨 JanKavach Alert
Zone: FOB-1 — CRITICAL
"Crowd surge detected. Immediate response required."
[View Details]  [Acknowledge]
```

---

### F12 — Background Crowd Video Player

A video element plays real crowd footage in a Picture-in-Picture panel at the bottom-left of the dashboard. When no video file is present, shows a placeholder frame with a "📹 Awaiting video feed" label. When density in any zone goes critical, the video panel enlarges with a red border pulse. Supports any MP4 placed at `data/videos/demo_crowd.mp4`.

---

## 6. Demo Architecture — The Primary Deliverable

**The demo is the product for Round 1. Build the demo first. Everything else serves the demo.**

### 6.1 Demo Scenario

**Scenario Name:** "The FOB-3 Event" (based on New Delhi Feb 2025)

**Setup:** A crowd of Kumbh Mela pilgrims is waiting at New Delhi station for a train to Prayagraj. A conflicting announcement sends them rushing from Platform 12 to Platform 16, creating a convergent crowd flow on Foot Over Bridge 3.

**Video Input:** Pre-processed video of dense crowd movement (from public dataset — ShanghaiTech Part A or UCF_CC_50). Will be trimmed to 5 minutes.

**Scenario Timeline:**
```
t=0:00   Baseline crowd — Green zones
t=0:45   Flow vectors on FOB-3 begin converging
t=1:00   Zone density crosses Amber on two platforms
t=1:30   ⚡ JanKavach: L1 PA fires autonomously — 
           "Platform 12 is congested. Please proceed via Gate C."
t=1:45   Flow dispersion begins (after L1 PA)
t=2:00   Zone density returns to Amber
t=2:30   System marks "Incident Averted" in feed

--- PARALLEL: Human-operated timeline (left panel) ---
t=3:08   Zone crosses crush density (6+ persons/m²)  
t=3:12   Human operator notices on screen
t=4:05   Operator contacts supervisor by radio
t=4:12   Decision made to issue announcement
t=4:15   Announcement issued
t=4:15   [CRUSH HAS ALREADY OCCURRED]
```

### 6.2 Demo Flow (Exactly What Judges See)

**Step 1 — Opening Screen (5 seconds)**
- Black screen with single white text: *"February 15, 2025. New Delhi Railway Station. 18 people died."*
- Fade to dashboard

**Step 2 — Normal State (30 seconds)**
- Station dashboard shows green zones
- Clock running at 2x speed
- Presenter narrates: "On any normal day, the system monitors all zones. Everything is fine. Until it isn't."

**Step 3 — Crowd Builds (45 seconds)**
- Zones begin shifting to amber
- Flow vectors appear, pointing toward FOB-3
- Prediction overlay shows "⚠ Critical density predicted in 90 seconds on FOB-3"

**Step 4 — The Autonomous Response (30 seconds)**
- Zone crosses threshold
- L1 fires — visual pop: "🔴 L1 AUTO | PA-01 Issued | Response Time: 2.3s"
- Intervention feed logs it
- PA audio plays (pre-recorded sample audio clip): "Platform 12 is currently experiencing heavy congestion. Passengers are requested to proceed via Gate C to Platform 16."

**Step 5 — Split Screen Reveal (60 seconds)**
- Switch to split-screen mode
- Left: human-operated (no intervention until t=4m12s, crush occurs at t=3m08s)
- Right: JanKavach (intervention at t=1m30s, crush prevented)
- Bottom bar numbers update
- Presenter: "2.3 seconds. That's how long it takes JanKavach to respond. The human took 4 minutes. The crush happened at 3 minutes."

**Step 6 — Solution Close (30 seconds)**
- Return to dashboard overview
- Show: "Indian Railways is installing ₹150 billion worth of cameras. JanKavach is the intelligence layer that makes them act, not just watch."
- GitHub QR code visible

**Total demo time: ~3–4 minutes (fits within video requirement)**

### 6.3 Demo Requirements (Non-Negotiable)

- [ ] YOLOv8 must process real video frames — not animation, not hardcoded coordinates
- [ ] All interventions must log real timestamps from system clock
- [ ] Response time counters must be computed, not hardcoded
- [ ] Split screen must run identical video input in both panels
- [ ] Demo must work offline (no external API dependencies during demo)
- [ ] Demo must not crash — pre-test on target machine minimum 5 times
- [ ] Video output must be 1080p minimum

---

## 7. Technical Architecture

### 7.1 System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Amogh SYSTEM                        │
│                                                                   │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────────┐    │
│  │ VIDEO INPUT  │───▶│ VISION LAYER │───▶│ PREDICTION LAYER │    │
│  │             │    │ (YOLOv8)     │    │ (LSTM / Flow)    │    │
│  │ • Video file │    │             │    │                  │    │
│  │ • Webcam     │    │ • Detection  │    │ • 30s forecast   │    │
│  │ • RTSP feed  │    │ • Tracking   │    │ • 60s forecast   │    │
│  └─────────────┘    │ • Zone map   │    │ • 90s forecast   │    │
│                      └──────┬───────┘    └────────┬─────────┘    │
│                             │                     │              │
│                             ▼                     ▼              │
│                      ┌──────────────────────────────────┐        │
│                      │     DECISION ENGINE              │        │
│                      │     (Graded Intervention)        │        │
│                      │                                  │        │
│                      │  Zone state → Intervention Level │        │
│                      │  L1 → Auto-fire                  │        │
│                      │  L2 → 10s cancel window          │        │
│                      │  L3 → Human confirm              │        │
│                      └──────────────┬───────────────────┘        │
│                                     │                            │
│                                     ▼                            │
│                      ┌──────────────────────────────────┐        │
│                      │     FASTAPI BACKEND              │        │
│                      │     (WebSocket server)           │        │
│                      └──────────────┬───────────────────┘        │
│                                     │                            │
│                                     ▼                            │
│                      ┌──────────────────────────────────┐        │
│                      │     NEXT.JS FRONTEND             │        │
│                      │     (Dashboard + Demo)           │        │
│                      └──────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Tech Stack

| Layer | Technology | Justification |
|---|---|---|
| Person Detection | **YOLOv8n / YOLOv8s** (Ultralytics) | Proven 95.3% accuracy, 28 FPS, pre-trained on COCO, pip-installable in 2 min |
| Object Tracking | **ByteTrack** (built into Ultralytics) | Persistent IDs for flow vectors, no extra dependency |
| Prediction | **LSTM** (PyTorch) or rule-based extrapolation | Hackathon-viable; if LSTM infeasible in time, rule-based is acceptable fallback |
| Backend | **FastAPI** (Python) + **WebSocket** | Real-time push to frontend, simple setup |
| Frontend | **Next.js 14** + **TailwindCSS** | Fast development, built-in TypeScript |
| Charts | **Recharts** | Simple, React-native, time-series friendly |
| Station Map | **SVG** (custom drawn, inline React) | Controllable, themeable, no library dependency |
| Flow Vectors | **Custom SVG arrows** or **D3.js** | Animated flow indicators per zone |
| Animation | **Framer Motion** | Smooth intervention pop-ups and transitions |
| Audio | **Web Audio API** | PA announcement audio playback |
| Video Processing | **OpenCV-Python** | Frame extraction, preprocessing |
| Package Mgr | **pip** + **npm** | Standard |

### 7.3 Directory Structure

```
jankavach/
├── backend/
│   ├── main.py                 # FastAPI app + WebSocket endpoint
│   ├── vision/
│   │   ├── detector.py         # YOLOv8 inference wrapper
│   │   ├── tracker.py          # ByteTrack zone assignment
│   │   └── zone_map.py         # Station zone definitions
│   ├── prediction/
│   │   ├── lstm_model.py       # LSTM prediction model
│   │   ├── flow_vectors.py     # Optical flow / centroid tracking
│   │   └── extrapolator.py     # Rule-based fallback predictor
│   ├── decision/
│   │   ├── engine.py           # Graded intervention logic
│   │   ├── interventions.py    # L1/L2/L3 action definitions
│   │   └── feed.py             # Intervention feed log
│   ├── demo/
│   │   ├── scenario_runner.py  # Pre-scripted demo scenario
│   │   └── split_screen.py     # Dual timeline controller
│   └── requirements.txt
│
├── frontend/
│   ├── app/
│   │   ├── page.tsx            # Main dashboard
│   │   ├── demo/page.tsx       # Split-screen demo view
│   │   └── layout.tsx
│   ├── components/
│   │   ├── StationMap.tsx      # SVG station layout + overlays
│   │   ├── DensityHeatmap.tsx  # Color zone overlays
│   │   ├── FlowVectors.tsx     # Animated arrows
│   │   ├── InterventionFeed.tsx # Real-time action log
│   │   ├── PredictionOverlay.tsx # 90s forecast display
│   │   ├── SplitScreen.tsx     # Demo comparison view
│   │   ├── InterventionCard.tsx # L2/L3 confirm cards
│   │   ├── ZoneChart.tsx       # Time-series density chart
│   │   └── StatusBar.tsx       # Top status bar
│   ├── lib/
│   │   ├── websocket.ts        # WebSocket client
│   │   ├── types.ts            # TypeScript interfaces
│   │   └── constants.ts        # Zone definitions, thresholds
│   └── public/
│       └── audio/
│           └── pa-announcement.mp3  # Pre-recorded PA audio
│
├── data/
│   ├── videos/
│   │   └── demo_crowd.mp4      # Pre-processed demo video
│   └── models/
│       └── lstm_weights.pth    # Pre-trained weights
│
├── PRD.md
├── AGENT_RULES.md
├── problem_validation.md
└── README.md
```

### 7.4 Data Flow

```
1. demo_crowd.mp4
       │
       ▼
2. detector.py reads frames at 10 FPS
   → YOLOv8 detects persons in each frame
   → Each person assigned to zone (based on bounding box center + zone_map)
       │
       ▼
3. tracker.py maintains centroid history per tracked ID
   → Computes velocity vectors per zone
       │
       ▼
4. lstm_model.py takes last 30s of zone density sequences
   → Outputs predicted density at t+30, t+60, t+90
       │
       ▼
5. engine.py evaluates:
   - Current density per zone
   - Predicted density per zone
   - Intervention level logic
   → If L1 threshold breached: fire intervention immediately
   → If L2: emit to frontend with 10s countdown
   → If L3: emit to frontend as confirm card
       │
       ▼
6. FastAPI WebSocket broadcasts to frontend every 100ms:
   {
     "zones": { "P1": { "density": 4.2, "color": "amber", "count": 38 }, ... },
     "predictions": { "P1_t90": { "density": 6.1, "color": "critical" }, ... },
     "interventions": [...],
     "flow_vectors": [...]
   }
       │
       ▼
7. Next.js frontend renders:
   - StationMap with heatmap overlay
   - FlowVectors animated
   - PredictionOverlay (ghost state at t+90)
   - InterventionFeed scrolling
   - InterventionCards for L2/L3
```

---

## 8. Data Strategy

### 8.1 Video Input

**Primary:** Use pre-processed video from [ShanghaiTech Part A](https://github.com/desenzhou/ShanghaiTechDataset) crowd density dataset — contains high-density crowd footage used in academic research. This is legally usable for research/demo purposes.

**Alternative:** UCF_CC_50 dataset — 50 crowd images, some with density maps.

**Processing:** Pre-trim a 5-minute clip. Map crowd regions to our custom zone layout.

**Do NOT use:** Live news footage, IRCTC/Indian Railways proprietary footage, any footage without clear research/creative commons license.

### 8.2 LSTM Training Data

**Option A (Preferred):** Synthetic training data
- Generate density sequences with realistic crowd wave patterns
- Simulate 3 crowd behaviors: dispersing, converging, steady-state
- Train for 50 epochs in ~20 minutes on CPU
- This is legitimate for a proof-of-concept

**Option B (Faster):** Rule-based prediction
- If density in zone X is increasing at rate R per 10s, predict linear extrapolation
- Add convergence detection: if adjacent zones both have inward flow, flag convergence
- Clearly label in demo as "Rule-based predictive model" — honest, still impressive

**Do NOT claim:** "Trained on real Indian Railway station data" (we don't have this)

### 8.3 Zone Map

Create a custom SVG station layout representing a generic major Indian terminal station:
- 6 platforms (P1–P6)
- 2 Foot Over Bridges (FOB-1, FOB-2)
- 3 gates (Gate A, B, C)
- 1 concourse area
- 2 escalators

This is a fictional layout. Do not claim it represents any specific real station.

---

## 9. UI/UX Specifications

### 9.1 Design System

**Theme:** Dark mode (control room aesthetic)

**Color Palette:**
```
Background:      #0D1117   (near-black)
Surface:         #161B22   (dark card)
Border:          #21262D   (subtle border)

Safe (Green):    #22C55E   (zone: 0–3/m²)
Warning (Amber): #F59E0B   (zone: 3–5/m²)
Critical (Red):  #EF4444   (zone: 5–6/m²)
Lethal (Pulse):  #EF4444 pulsing animation (zone: 6+/m²)

L1 Action:       #22C55E   (auto, safe)
L2 Action:       #F59E0B   (staged, moderate)
L3 Action:       #EF4444   (confirm required, critical)

Accent Blue:     #3B82F6   (UI elements, links)
Text Primary:    #F1F5F9
Text Secondary:  #94A3B8
```

**Typography:**
```
Font family:  'JetBrains Mono' for data values (monospace feel)
             'Inter' for labels and UI text
Sizes:       xs: 11px, sm: 12px, base: 14px, lg: 16px, xl: 20px, 2xl: 24px
```

### 9.2 Main Dashboard Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Amogh  │  New Delhi Station  │  Live  ●  │  14:32:07     │
│  [Dashboard] [Demo] [Split Screen]              Status: ACTIVE  │
├──────────────────────────────────────┬──────────────────────────┤
│                                      │  INTERVENTION FEED        │
│         STATION MAP                  │  ─────────────────────── │
│         (SVG + Heatmap overlay)      │  14:32:05 🔴 L1 AUTO     │
│                                      │  Zone P3 | 2.3s response │
│    P1 P2 P3 P4 P5 P6                │  PA-01 Issued             │
│    [zones colored green/amber/red]   │                           │
│    [flow arrows animated]            │  14:31:58 🟡 L2 STAGED   │
│    [ghost overlay for t+90]         │  Zone FOB-2 | Gate-B      │
│                                      │  [CANCEL] [CONFIRM]       │
│                                      │                           │
│                                      │  14:31:45 🟢 L1 AUTO     │
│                                      │  Zone P1 | Escalator ↕   │
├──────────────────────────────────────┤                           │
│  ZONE DENSITY (last 60s)             │                           │
│  [sparkline charts per zone]         │                           │
│  P1:████░░  P2:██░░░░  P3:█████░    │                           │
└──────────────────────────────────────┴──────────────────────────┘
```

### 9.3 Split Screen Layout

```
┌──────────────────────────────┬──────────────────────────────────┐
│  ❌ HUMAN-OPERATED           │  ✅ Amogh                   │
│  "Current System"            │  "Autonomous Response"           │
├──────────────────────────────┼──────────────────────────────────┤
│                              │                                  │
│  [Station map - same input]  │  [Station map - same input]     │
│                              │                                  │
│  t=3m08s                     │  t=1m30s                        │
│  ⚠️ CRUSH FORMING            │  ✅ INTERVENTION FIRED           │
│  Awaiting operator...        │  PA-01 Auto-issued              │
│                              │  Response time: 2.3s            │
│                              │                                  │
│  [RED FLASH ANIMATION]       │  [Green "AVERTED" badge]        │
│                              │                                  │
├──────────────────────────────┴──────────────────────────────────┤
│                                                                  │
│  Human Response:  4 min 12 sec  │  JanKavach: 2.3 seconds     │
│  Outcome: CRUSH OCCURRED        │  Outcome: CRUSH PREVENTED     │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 9.4 Intervention Card (L2/L3)

```
┌─────────────────────────────────────────────────┐
│  ⚠️  LEVEL 2 — STAGED ACTION                    │
│  Zone: FOB-3                                     │
│  Trigger: Convergent flow + Density 5.8/m²      │
│                                                  │
│  Proposed Action:                                │
│  Reduce Gate-B throughput by 50%                │
│                                                  │
│  Auto-executing in:  [████████░░] 7s            │
│                                                  │
│  [CANCEL]                    [CONFIRM NOW]       │
└─────────────────────────────────────────────────┘
```

### 9.5 Animations (Required)

| Element | Animation | Library |
|---|---|---|
| Zone color transition | 500ms ease-in-out | CSS transition |
| Intervention card appear | Slide up + fade in | Framer Motion |
| Critical zone | Pulsing border glow | CSS keyframes |
| Flow vectors | Animated dashes along path | CSS stroke-dashoffset |
| Prediction ghost | 60% opacity, dashed border | CSS |
| "CRUSH OCCURRED" alert | Red screen flash | Framer Motion |
| Response time counter | Real-time increment | setInterval |
| Intervention feed | Smooth scroll to new item | scrollIntoView |

---

## 10. API Specifications

### 10.1 WebSocket: `/ws/live`

**Direction:** Backend → Frontend (push)  
**Frequency:** Every 100ms

```typescript
interface LiveUpdate {
  timestamp: string;           // ISO 8601
  zones: {
    [zoneId: string]: {
      density: number;         // persons per m²
      count: number;           // total persons in zone
      color: 'green' | 'amber' | 'red' | 'critical';
      flow_vector: {
        dx: number;            // normalized -1 to 1
        dy: number;            // normalized -1 to 1
        magnitude: number;     // 0 to 1
      };
    }
  };
  predictions: {
    [zoneId: string]: {
      t30: { density: number; color: string };
      t60: { density: number; color: string };
      t90: { density: number; color: string };
    }
  };
  interventions: Intervention[];
  system_status: 'normal' | 'monitoring' | 'active' | 'critical';
}

interface Intervention {
  id: string;
  timestamp: string;
  level: 1 | 2 | 3;
  zone: string;
  trigger: string;
  action: string;
  status: 'fired' | 'staged' | 'pending_confirm' | 'cancelled' | 'confirmed';
  response_time_ms: number;
  countdown_remaining?: number;  // For L2
}
```

### 10.2 REST: `POST /intervention/{id}/confirm`

Confirms a Level 2 or Level 3 staged intervention.

```typescript
// Response
{ "status": "confirmed", "action_time": "14:32:15" }
```

### 10.3 REST: `POST /intervention/{id}/cancel`

Cancels a staged intervention within the countdown window.

### 10.4 REST: `POST /demo/start`

Starts the pre-scripted demo scenario. Begins video processing + scenario timeline.

```typescript
// Body
{ "scenario": "fob3_event", "speed_multiplier": 2.0 }
```

### 10.5 REST: `GET /demo/status`

Returns current demo scenario state.

---

## 11. 48-Hour Build Plan

**Team assumption: 2–3 people. Assign roles before starting.**

| Role | Person | Focus |
|---|---|---|
| Backend / CV Engineer | Person A | YOLOv8 pipeline, FastAPI, WebSocket |
| Frontend Engineer | Person B | Next.js dashboard, animations, demo view |
| Prediction / Demo Designer | Person C (or Person A after CV done) | LSTM/predictor, demo script, scenario data prep |

---

### Hour-by-Hour Plan

#### Phase 0: Setup (Hour 0–2)

- [ ] Create repository, push initial structure
- [ ] Install all dependencies (verify before hackathon: ultralytics, fastapi, uvicorn, torch, opencv-python, next, tailwindcss, framer-motion, recharts)
- [ ] Download demo video (ShanghaiTech Part A or similar)
- [ ] Test YOLOv8n on demo video — confirm inference is working
- [ ] Create basic Next.js app with Tailwind configured
- [ ] Establish WebSocket connection between FastAPI and Next.js (echo test)

**Checkpoint: YOLOv8 detecting persons in demo video. WebSocket sending data to browser.**

---

#### Phase 1: Vision Layer (Hour 2–6)

**Person A:**
- [ ] `detector.py`: YOLOv8 inference on video frames, return bounding boxes
- [ ] `zone_map.py`: Define 10 zones (P1–P6, FOB-1, FOB-2, Gate A/B) as pixel coordinates in video
- [ ] `tracker.py`: Assign each detected person to a zone, count per zone, compute density (persons/area)
- [ ] `flow_vectors.py`: Track centroid movement per zone over last 10 frames, compute avg flow direction
- [ ] Expose zone state as Python dict, update every 100ms

**Person B:**
- [ ] Draw station layout SVG in React (simple rectangles for platforms, lines for FOBs, gates)
- [ ] `StationMap.tsx`: Accepts zone data props, renders colored overlays
- [ ] `FlowVectors.tsx`: Renders animated arrows based on flow direction
- [ ] Basic color transition working (green → amber → red based on density prop)

**Checkpoint: Live density data visible in browser, updating from real video inference.**

---

#### Phase 2: Prediction + Decision Engine (Hour 6–14)

**Person A / C:**
- [ ] `extrapolator.py`: Rule-based predictor (trend extrapolation + convergence detection)
  - If zone density increasing: project forward at same rate
  - If two adjacent zones have converging vectors: flag convergence event
- [ ] `lstm_model.py`: Optional — LSTM trained on synthetic data (only if time allows)
- [ ] `engine.py`: Decision logic
  - Map zone + prediction state → intervention level
  - L1: auto-fire and log
  - L2: emit staged intervention with countdown
  - L3: emit confirm-required intervention
- [ ] `feed.py`: Intervention log data structure

**Person B:**
- [ ] `PredictionOverlay.tsx`: Ghost state overlay on station map showing t+90 predicted density
- [ ] `InterventionFeed.tsx`: Scrolling log, color-coded by level
- [ ] `InterventionCard.tsx`: L2/L3 confirm card with countdown timer
- [ ] WebSocket client in Next.js: receives updates, dispatches to components

**Checkpoint: Prediction visible on map. Intervention cards appearing and auto-firing.**

---

#### Phase 3: Demo Scenario + Split Screen (Hour 14–24)

**Person A / C:**
- [ ] `scenario_runner.py`: Pre-scripted scenario "FOB-3 Event"
  - Timeline of events: when which zone hits which density
  - Supports 2x speed replay
- [ ] `split_screen.py`: Runs two parallel timelines from same input
  - Right: full JanKavach logic
  - Left: same input, but interventions suppressed until t=4m12s

**Person B:**
- [ ] `SplitScreen.tsx`: Side-by-side layout
  - Left panel: "Human-Operated" with no auto-interventions
  - Right panel: JanKavach with full autonomy
  - Bottom bar: response time comparison, outcome badges
- [ ] "CRUSH OCCURRED" animation on left panel at t=3m08s
- [ ] "AVERTED" badge on right panel

**Person C:**
- [ ] Record PA announcement audio (clear voice, read the script): 
  - "Platform 12 is currently experiencing heavy congestion. Passengers are requested to proceed via Gate C to Platform 16."
- [ ] Finalize demo video clip (trimmed, correct aspect ratio)
- [ ] Test full demo scenario end-to-end

**Checkpoint: Full demo scenario runs without crashes. Split screen showing clear comparison.**

---

#### Phase 4: Polish + Presentation (Hour 24–36)

**Person B:**
- [ ] Add Framer Motion animations (intervention card slide-in, zone pulse, feed scroll)
- [ ] Opening screen: "February 15, 2025. 18 people died." fade-in
- [ ] Responsive layout — dashboard must look good on 1080p screen
- [ ] Status bar with live clock
- [ ] Dark mode polish (spacing, fonts, shadows)

**Person C:**
- [ ] Write 15-slide presentation (see Section 14)
- [ ] Write GitHub README (problem, solution, tech stack, demo instructions, screenshots)
- [ ] Record demo video (2–5 minutes)

**Person A:**
- [ ] Error handling — demo must not crash on WebSocket disconnect
- [ ] Preload everything — no network calls during demo
- [ ] Write setup instructions in README (must be runnable from cold clone in <10 minutes)

**Checkpoint: Demo video recorded. Presentation complete. GitHub clean.**

---

#### Phase 5: Buffer + Submission (Hour 36–48)

- [ ] Final end-to-end test on clean machine
- [ ] Submit GitHub repository link
- [ ] Submit presentation/video
- [ ] Cross-check all claims in presentation against AGENT_RULES.md

---

## 12. Acceptance Criteria

### Must Have (Demo Fails Without These)

- [ ] YOLOv8 runs real inference on real video — no hardcoded zone states
- [ ] L1 interventions fire within 3 seconds of threshold (clock-verified)
- [ ] Split-screen demo shows clear quantitative comparison (4m12s vs. 2.3s)
- [ ] Intervention feed shows real timestamps from system clock
- [ ] Dashboard is dark mode, visually polished, no placeholder/Lorem text
- [ ] GitHub repository exists with working code
- [ ] README has setup instructions that actually work

### Should Have

- [ ] LSTM prediction (or rule-based extrapolation) showing t+90 overlay
- [ ] PA audio plays automatically on L1 fire
- [ ] L2 countdown card with cancel/confirm
- [ ] Flow vector arrows animated on station map
- [ ] Response time displayed in milliseconds

### Nice to Have

- [ ] Multiple scenario presets (FOB-3 Event, Gate Rush, Platform Surge)
- [ ] Zone-by-zone time-series sparkline charts
- [ ] Export intervention log as CSV
- [ ] Mobile-responsive layout

### Explicitly Out of Scope

- Connection to real Indian Railways CCTV or RailTel infrastructure
- Facial recognition or individual identification
- Real gate/escalator hardware control
- Production-ready safety certification
- Multi-station deployment

---

## 13. Risk Register

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| YOLOv8 too slow on CPU (target machine has no GPU) | Medium | Critical | Use YOLOv8n (smallest variant). Pre-process video to 480p. If still slow, pre-compute all detections offline and replay from cache. |
| WebSocket latency causes UI lag | Low | High | Batch updates every 100ms. Use requestAnimationFrame on frontend. |
| Demo video does not have suitable crowd density | Medium | High | Pre-process ShanghaiTech video offline. Verify person counts in zones before hackathon. |
| LSTM not trained in time | Medium | Medium | Fall back to rule-based extrapolator. Label it "rule-based predictive model" — honest and still impressive. |
| Split-screen timeline sync issues | Medium | High | Run both timelines from same shared clock. Test this specific scenario 10+ times. |
| Framer Motion animations janky | Low | Low | Reduce animation complexity. Performance > visual polish. |
| Team member unfamiliar with WebSockets | Medium | Medium | Use simple FastAPI WebSocket example as starter. Test connection first. |
| Claim challenged by judge ("this isn't really autonomous") | Medium | High | Explicitly state: "L1 is fully autonomous. L2 has a cancel window. L3 requires confirm. This is graded autonomy — the same model used in self-driving cars." |

---

## 14. Presentation Structure

**Format:** 15 slides max (per hackX 1.0 requirement)

| Slide | Title | Content |
|---|---|---|
| 1 | Hook | "February 15, 2025. New Delhi Railway Station. 18 dead." Single image. No text other than the date and number. |
| 2 | The Failure | The current system: cameras + humans + slow decision chain. Visual timeline of a stampede forming vs. human response time. |
| 3 | The Real Problem | "The cameras exist. The data exists. The problem is the 4-minute human decision loop." Show the 8–15 minute warning window research. |
| 4 | Existing Solutions & Why They Fail | Competitor table: Thales, Createc, Kumbh ICCC. All: "alert humans." None: autonomous action. |
| 5 | Introducing JanKavach | One-line: "Predict → Act → Prevent." Three-layer diagram. |
| 6 | How It Works: Predict | 90-second flow vector forecasting. Show the prediction overlay screenshot. |
| 7 | How It Works: Respond | Graded autonomy (L1/L2/L3). L1 fires in 2.3 seconds. |
| 8 | Live Demo | [EMBED DEMO VIDEO OR LINK] |
| 9 | The Numbers That Matter | 2.3s vs. 4m12s. 18 deaths prevented in one station on one day. 145 deaths/year India average. |
| 10 | Technical Architecture | Simplified diagram: Video → YOLOv8 → LSTM → Decision Engine → Actions |
| 11 | Why Now | ₹150B in cameras being installed. Government mandate post-Delhi High Court order. Thales acquired = market gap. |
| 12 | Market Opportunity | TAM: $5–10B. India SAM: $125M. 308 stations with existing CCTV. |
| 13 | Roadmap | Phase 1: Software pilot (3 months). Phase 2: RailTel integration (6 months). Phase 3: National rollout (18 months). |
| 14 | The Team | Names, roles, institutions. |
| 15 | Close | "Indian Railways is building the infrastructure. We are the intelligence that makes it act." GitHub QR code. Contact. |

---

## 15. Grounding Rules — Hallucination Prevention

**These rules apply to all AI agents, all human contributors, and all presentation content. Every claim must trace to problem_validation.md or observed system behavior.**

### 15.1 Statistics Rules

| ✅ Allowed | ❌ Not Allowed |
|---|---|
| "18 people died at New Delhi station, Feb 2025" | "Dozens died" / "Hundreds die annually at stations" |
| "120+ deaths from stampedes in India in 2025" | "Thousands of deaths" |
| "145 average annual stampede deaths in India (2001–2022)" | "Hundreds of people die annually" |
| "₹150 billion investment in AI CCTV" | "Billions spent on surveillance" (ambiguous) |
| "YOLOv8 achieves 95.3% detection accuracy" | "Our AI achieves near-perfect accuracy" |
| "Crowd crush warning window: 8–15 minutes" | "Minutes before a crush occurs" (too vague) |
| "Zero commercial products with autonomous physical intervention found in research" | "No solution exists" (too absolute — qualified claim only) |

### 15.2 Technical Claims Rules

| ✅ Allowed | ❌ Not Allowed |
|---|---|
| "System processes real YOLOv8 inference on pre-recorded video" | "Live camera feed from railway stations" |
| "Simulation environment representing a generic major terminal" | "Deployed at New Delhi Railway Station" |
| "LSTM trained on synthetic crowd density sequences" | "Trained on Indian Railways historical data" |
| "Rule-based predictive model extrapolating crowd flow" | "Deep learning prediction" (if not using LSTM) |
| "L1 actions fire autonomously without human input" | "Fully autonomous crowd management system" |
| "L3 gate closure requires human confirmation" | "System autonomously closes gates" |
| "Response time: 2.3 seconds to L1 action" | "Instant response" |

### 15.3 Competitor Claims Rules

| ✅ Allowed | ❌ Not Allowed |
|---|---|
| "Thales DIVA alerts humans — it does not autonomously trigger physical actions" | "Thales has no solution" |
| "Thales DIVA was sold to Hitachi Rail in May 2024" | "Thales exited the market" |
| "No commercially deployed product found with autonomous intervention capability" | "We are the only solution" |
| "Kumbh Mela deployed 1,800 AI cameras and 400 human operators" | "Government has no technology" |

### 15.4 Demo Integrity Rules

- The demo video must show **real YOLOv8 inference** running. Not a screen recording of a pre-built animation.
- The response time displayed (2.3s) must be **computed from system clock**, not hardcoded.
- The intervention feed timestamps must be **live system time**.
- The split-screen must run on **identical input data**, not two separate pre-scripted animations.
- If any component fails during demo recording, **label it explicitly** rather than hiding the failure.

### 15.5 Autonomy Claims Rules

Always use the phrase **"graded autonomous response"**, not "fully autonomous system."

The specific language to use:
> *"Level 1 interventions — PA announcements, digital signage updates, escalator direction — fire autonomously within seconds of threshold breach. Level 2 actions have a 10-second human cancel window. Level 3 actions (gate closure) require explicit human confirmation. This mirrors the graded autonomy approach used in aviation and autonomous vehicle design."*

### 15.6 What Agents Must Not Generate

- Do not generate or invent statistics not in `problem_validation.md`
- Do not claim the system is connected to real railway infrastructure
- Do not claim the LSTM was trained on real-world crowd crush data
- Do not claim gate closure happens autonomously
- Do not claim any specific station name is using this system
- Do not generate API keys, credentials, or access tokens
- Do not claim the system has been "deployed" or "tested in production"
- Do not add features not listed in this PRD without explicit approval

---

*JanKavach — PRD v1.0*  
*Build the demo first. The demo is the product.*
