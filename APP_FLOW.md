# JanKavach — App Flow Diagrams

---

## 1. System Data Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          JanKavach DATA PIPELINE                            │
│                                                                               │
│  ┌──────────────┐                                                             │
│  │  VIDEO INPUT  │  demo_crowd.mp4 (ShanghaiTech) — 5 min clip               │
│  └──────┬───────┘                                                             │
│         │ frames @ 10 FPS                                                     │
│         ▼                                                                     │
│  ┌──────────────────────────────────────────────────────────┐                │
│  │  VISION LAYER                                             │                │
│  │                                                           │                │
│  │  detector.py      → YOLOv8n inference                    │                │
│  │                     returns bounding boxes per frame      │                │
│  │                                                           │                │
│  │  tracker.py       → ByteTrack assigns person IDs         │                │
│  │                     maps each person → zone (P1–P6,      │                │
│  │                     FOB-1, FOB-2, Gate A/B/C)            │                │
│  │                     counts persons per zone               │                │
│  │                     computes density (persons/m²)         │                │
│  │                                                           │                │
│  │  zone_map.py      → pixel coordinate boundaries          │                │
│  │                     for each of the 10 station zones     │                │
│  └──────┬───────────────────────────────────────────────────┘                │
│         │ zone states (density, count, flow vectors)                          │
│         ▼                                                                     │
│  ┌──────────────────────────────────────────────────────────┐                │
│  │  PREDICTION LAYER                                         │                │
│  │                                                           │                │
│  │  extrapolator.py  → rule-based trend extrapolation       │                │
│  │                     if density↑ at rate R → project fwd  │                │
│  │                     convergence detection on adj. zones   │                │
│  │                                                           │                │
│  │  outputs:  t+30s  /  t+60s  /  t+90s  per zone          │                │
│  └──────┬───────────────────────────────────────────────────┘                │
│         │ current state + predictions                                          │
│         ▼                                                                     │
│  ┌──────────────────────────────────────────────────────────┐                │
│  │  DECISION ENGINE  (engine.py)                             │                │
│  │                                                           │                │
│  │  zone density ──► color classification                    │                │
│  │   0–3 /m²  →  GREEN   (safe)                             │                │
│  │   3–5 /m²  →  AMBER   (monitor)                          │                │
│  │   5–6 /m²  →  RED     (L1 auto-fire)                     │                │
│  │   6+  /m²  →  BLACK   (L2/L3 stage)                      │                │
│  │                                                           │                │
│  │  ┌─────────┐   ┌──────────────┐   ┌──────────────────┐  │                │
│  │  │   L1    │   │      L2      │   │        L3        │  │                │
│  │  │  AUTO   │   │   STAGED     │   │  HUMAN CONFIRM   │  │                │
│  │  │         │   │  (10s cancel)│   │  (one-tap only)  │  │                │
│  │  │ PA ann. │   │ Gate reduce  │   │ Platform closure  │  │                │
│  │  │ Signage │   │ RPF deploy   │   │ (never auto-fire) │  │                │
│  │  │ Escal.  │   │              │   │                  │  │                │
│  │  │ <3s     │   │   10s clock  │   │  pre-filled card  │  │                │
│  │  └────┬────┘   └──────┬───────┘   └────────┬─────────┘  │                │
│  └───────┼───────────────┼────────────────────┼────────────┘                │
│          │               │                    │                               │
│          ▼               ▼                    ▼                               │
│  ┌───────────────────────────────────────────────────────────┐               │
│  │  FASTAPI BACKEND (main.py)                                 │               │
│  │                                                            │               │
│  │  WebSocket /ws/live  →  push every 100ms to frontend      │               │
│  │  POST /demo/start    →  launches scenario_runner.py        │               │
│  │  POST /intervention/{id}/confirm                           │               │
│  │  POST /intervention/{id}/cancel                            │               │
│  └───────────────────────┬───────────────────────────────────┘               │
│                          │ JSON over WebSocket                                │
│                          ▼                                                    │
│  ┌───────────────────────────────────────────────────────────┐               │
│  │  NEXT.JS FRONTEND                                          │               │
│  │  (real-time React components, TailwindCSS, Framer Motion)  │               │
│  └───────────────────────────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Frontend UI Screen Flow

```
                    ┌──────────────────────┐
                    │    APP LOADS          │
                    │  lib/websocket.ts     │
                    │  connects to /ws/live │
                    └──────────┬───────────┘
                               │
                               ▼
              ┌────────────────────────────────┐
              │         TOP HEADER BAR          │
              │                                 │
              │  [CG] JanKavach  |  Simulation │
              │  [Dashboard] [Split Screen Demo] │
              │              STATUS ●  LIVE  ⏱  │
              │              [▶ Start Demo]      │
              └──────┬──────────────────┬───────┘
                     │                  │
         ┌───────────┘                  └─────────────┐
         │   view = "dashboard"          view = "split"│
         ▼                                             ▼
┌─────────────────────┐                    ┌──────────────────────┐
│   DASHBOARD VIEW     │                    │   SPLIT SCREEN DEMO   │
│  page.tsx            │                    │   SplitScreen.tsx     │
│                      │                    │                       │
│  ┌────────────────┐  │                    │  ┌────────┬─────────┐ │
│  │  STATION MAP   │  │                    │  │ HUMAN  │CROWDGRD │ │
│  │  StationMap.   │  │                    │  │OPERATED│         │ │
│  │  tsx           │  │                    │  │        │         │ │
│  │                │  │                    │  │ No     │  L1/L2  │ │
│  │ colored zones  │  │                    │  │ action │  fires  │ │
│  │ flow arrows    │  │                    │  │        │         │ │
│  │ +90s ghost     │  │                    │  │ CRUSH  │ AVERTED │ │
│  └────────────────┘  │                    │  │ t=3:08 │ t=1:30  │ │
│                      │                    │  └────────┴─────────┘ │
│  ┌────────────────┐  │                    │                       │
│  │  ZONE CHART    │  │                    │  ┌───────────────────┐│
│  │  ZoneChart.tsx │  │                    │  │   BOTTOM BAR      ││
│  │  last 30 ticks │  │                    │  │  Human: 4m12s     ││
│  └────────────────┘  │                    │  │  JanKavach: 2.3s ││
│                      │                    │  │  Crush: YES | NO  ││
│  ┌─────────────────┐ │                    │  └───────────────────┘│
│  │ CRITICAL ZONES  │ │                    └──────────────────────┘
│  │  FOB1 / FOB2   │ │
│  │  P3 / GATE_B   │ │
│  └─────────────────┘ │
│                      │
│  ┌─────────────────┐ │
│  │ INTERVENTION    │ │
│  │ FEED            │ │
│  │ InterventionFed │ │
│  │ .tsx            │ │
│  │                 │ │
│  │ [L1 AUTO] PA-01 │ │
│  │ [L2 STAGED]     │ │
│  │  ┌───────────┐  │ │
│  │  │CANCEL|NOW │  │ │◄── L2 card appears,
│  │  └───────────┘  │ │    10s countdown
│  │ [L3 CONFIRM]    │ │
│  │  ┌───────────┐  │ │
│  │  │  CONFIRM  │  │ │◄── L3 card, human must tap
│  │  └───────────┘  │ │
│  └─────────────────┘ │
│                      │
│  ┌─────────────────┐ │
│  │ 90s FORECAST    │ │
│  │ FOB1 +30/60/90s │ │
│  └─────────────────┘ │
└──────────────────────┘
```

---

## 3. Intervention Decision Flow

```
                  ┌─────────────────────────────┐
                  │  Zone density evaluated       │
                  │  every 100ms by engine.py    │
                  └──────────────┬──────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
     density 5–6/m²     density 6+/m²      predicted t+60 →
     (RED zone)         (BLACK zone)       converging crush
              │                  │                  │
              ▼                  ▼                  ▼
        ┌──────────┐      ┌──────────┐       ┌──────────┐
        │  LEVEL 1 │      │  LEVEL 2 │       │  LEVEL 3 │
        │  AUTO    │      │  STAGED  │       │  CONFIRM │
        └────┬─────┘      └────┬─────┘       └────┬─────┘
             │                 │                   │
             ▼                 ▼                   ▼
     ┌──────────────┐  ┌─────────────────┐  ┌─────────────────┐
     │ Fires        │  │ Emits card to   │  │ Emits card to   │
     │ immediately  │  │ frontend with   │  │ frontend        │
     │ (<3 seconds) │  │ 10s countdown   │  │ NO countdown    │
     │              │  │                 │  │                 │
     │ • PA audio   │  │ • Gate reduce   │  │ • Platform      │
     │   plays      │  │   by 50%        │  │   full closure  │
     │ • Signage    │  │ • RPF request   │  │                 │
     │   updated    │  │                 │  │ Waits for       │
     │ • Escalator  │  │ Human sees it   │  │ explicit CONFIRM│
     │   direction  │  │                 │  │ tap — NEVER     │
     │   flipped    │  │ ┌─────────────┐ │  │ auto-fires      │
     └──────┬───────┘  │ │  10s timer  │ │  └────────┬────────┘
            │          │ │  ██████░░░░ │ │           │
            ▼          │ └──────┬──────┘ │  ┌────────┴────────┐
     ┌──────────────┐  │        │        │  │ Human confirms  │
     │ Logged to    │  │   no action     │  │ → action fires  │
     │ Intervention │  │   within 10s   │  │                 │
     │ Feed with    │  │        │        │  │ Human cancels   │
     │ timestamp +  │  │        ▼        │  │ → action drops  │
     │ response time│  │ auto-executes   │  └─────────────────┘
     └──────────────┘  │ action          │
                       └─────────────────┘
```

---

## 4. Demo Scenario Timeline (What Judges See)

```
TIMELINE ──────────────────────────────────────────────────────────────────────►

t=0:00   t=0:45    t=1:00    t=1:30       t=2:00  t=2:30
  │         │         │         │            │       │
  ▼         ▼         ▼         ▼            ▼       ▼
┌─────┐  ┌──────┐  ┌──────┐  ┌──────────┐ ┌─────┐ ┌─────────────┐
│Green│  │Flow  │  │Amber │  │⚡ L1 AUTO│ │Amber│ │ INCIDENT    │
│zones│  │vec.  │  │on P12│  │ PA fires │ │zones│ │ AVERTED     │
│All  │  │on    │  │& P16 │  │ "Pltfm 12│ │drops│ │ logged      │
│safe │  │FOB-3 │  │      │  │ use Gate │ │back │ │ in feed     │
│     │  │convg.│  │      │  │  C"      │ │     │ │             │
│     │  │      │  │⚠️ Pred│  │          │ │     │ │             │
│     │  │      │  │crit. │  │PA audio  │ │     │ │             │
│     │  │      │  │in 90s│  │plays     │ │     │ │             │
└─────┘  └──────┘  └──────┘  └──────────┘ └─────┘ └─────────────┘


  ═══════════════ SPLIT SCREEN — PARALLEL HUMAN TIMELINE ══════════════

t=0:00                              t=3:08    t=3:12  t=4:05  t=4:12  t=4:15
  │                                   │         │       │       │       │
  ▼                                   ▼         ▼       ▼       ▼       ▼
┌──────────┐                       ┌───────┐ ┌──────┐ ┌────┐ ┌──────┐ ┌──────┐
│Same video│                       │CRUSH  │ │Human │ │Call│ │Annc. │ │TOO   │
│No inter- │                       │DENSITY│ │notices│ │super│ │decid.│ │LATE  │
│ventions  │                       │6+/m²  │ │on cam │ │visor│ │      │ │CRUSH │
│Waiting   │                       │⚠️ RED  │ │       │ │     │ │      │ │HAPND │
│for human │                       │FLASH  │ │       │ │     │ │      │ │      │
└──────────┘                       └───────┘ └──────┘ └────┘ └──────┘ └──────┘


  ════════════════════ BOTTOM BAR COMPARISON ════════════════════════

  ┌─────────────────────────────────────────────────────────────────┐
  │  Human Response Time:  4 min 12 sec  │  JanKavach:  2.3 sec   │
  │  Crush occurred:  YES ✗              │  Crush prevented:  YES ✓ │
  └─────────────────────────────────────────────────────────────────┘
```

---

## 5. WebSocket Data Contract (Frontend ↔ Backend)

```
Backend → Frontend  (every 100ms via /ws/live)
┌────────────────────────────────────────────────────────┐
│  {                                                      │
│    "jankavach": {                                      │
│      "zones": {                                         │
│        "P3": { density, count, color, flow_vector }    │
│        ...10 zones total                                │
│      },                                                 │
│      "predictions": {                                   │
│        "P3": { t30, t60, t90 }  ← ghost overlay data  │
│      }                                                  │
│    },                                                   │
│    "human": {  ← split screen only, interventions OFF  │
│      "zones": { same structure, no actions taken }      │
│    },                                                   │
│    "interventions": [ ...feed entries ]                 │
│    "staged": { L2/L3 pending confirm/cancel }          │
│    "system_status": "normal" | "monitoring" | ...      │
│  }                                                      │
└────────────────────────────────────────────────────────┘

Frontend → Backend  (user actions only)
┌────────────────────────────────────────────────────────┐
│  POST /demo/start          → kick off scenario_runner   │
│  POST /intervention/{id}/confirm  → fire L2/L3 action  │
│  POST /intervention/{id}/cancel   → abort countdown    │
└────────────────────────────────────────────────────────┘
```

---

## 6. Component Hierarchy

```
app/page.tsx  (state: view, historyMap, clock, WebSocket data)
│
├── <header>  (nav, status dot, clock, ▶ Start Demo button)
│
└── <main>
     ├── [view="dashboard"]
     │    ├── StationMap.tsx       ← zones + predictions + flow arrows
     │    ├── ZoneChart.tsx        ← sparklines per zone, last 30 ticks
     │    ├── InterventionFeed.tsx ← scrolling log + L2/L3 action cards
     │    └── (prediction summary) ← +30/60/90s per high-risk zone
     │
     └── [view="split"]
          └── SplitScreen.tsx
               ├── Left panel  — human timeline (interventions suppressed)
               ├── Right panel — JanKavach timeline (full autonomy)
               └── Bottom bar  — response time + outcome comparison

---

## 7. Statutory Black-Box Flight Recorder & Forensic Audit Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│             STATUTORY "BLACK-BOX" FLIGHT RECORDER ARCHITECTURE              │
│                                                                               │
│  Decision Engine / Vision Pipeline / Human Confirmations                      │
│         │                                                                     │
│         ├─────────────────────────────┬─────────────────────────────┐         │
│         ▼                             ▼                             ▼         │
│  [Autonomous Action]        [Human Confirmation]           [Critical Tier]   │
│  L1 PA Announcement         L2 Escalator Direction          L1, L2, PRE-WARN, │
│  Signage Routing Change     L3 Platform Closure Gate        L3, SOS Alert     │
│         │                             │                             │         │
│         ▼                             ▼                             ▼         │
│  ┌──────────────────────────────────────────────┐          ┌────────────────┐ │
│  │ flight_recorder.py (WORM Audit Ledger)       │          │ snapshot_engine│ │
│  │                                              │          │ .py            │ │
│  │ 1. Canonical JSON representation             │          │                │ │
│  │ 2. Embeds prev_hash (Blockchain-style chain) │          │ 1. CCTV Frame  │ │
│  │ 3. Computes SHA-256 hash                     │          │ 2. Burns legal │ │
│  │ 4. Appends to data/audit_logs/CRS_*.jsonl    │          │    watermark   │ │
│  └──────────────────────┬───────────────────────┘          │ 3. Writes JPEG │ │
│                         │                                  └────────┬───────┘ │
│                         │                                           │         │
│                         ▼                                           ▼         │
│            data/audit_logs/CRS_*.jsonl                     data/snapshots/    │
│            (Immutable Event Sequence)                      (Forensic Proof)   │
│                         │                                           │         │
│         ┌───────────────┴───────────────────────────┬───────────────┘         │
│         ▼                                           ▼                         │
│  ┌──────────────────────────────┐        ┌──────────────────────────────────┐ │
│  │ backend/verify_audit.py      │        │ AuditDossierModal.tsx            │ │
│  │ Standalone CLI Tool          │        │ Statutory Forensic UI            │ │
│  │                              │        │                                  │ │
│  │ • Re-hashes every block      │        │ • Live SHA-256 hash verification │ │
│  │ • Detects log tampering      │        │ • Historical incident selector   │ │
│  │ • CRS Compliance Summary     │        │ • Forensic snapshot lightbox     │ │
│  │ • Exits 0 (Valid) / 1 (Tamper│        │ • 1-Click JSON Dossier Export    │ │
│  └──────────────────────────────┘        └──────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

