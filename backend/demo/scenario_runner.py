"""
NDLS Feb 15 2025 — Maha Kumbh Crowd Crush Scenario
Replays the real New Delhi Railway Station stampede (18 dead, 15 injured).

Real timeline (IST):
  20:15  — Crowd density building on FOB-3 (Pf 14/15 stairway)
  20:30  — Prayagraj Special moved from Pf 12 → Pf 16, announcement causes panic surge
  20:48  — CRUSH: headload falls on FOB-3 stairs, pile-up, 18 killed
  21:55  — Delhi Fire Service receives first call (67 min after crush)
  22:40  — Fire tenders arrive on scene (112 min after crush)

Scenario clock (300s total at speed=2.0 → 2.5 min demo):
  T=0    → 20:15  Normal elevated crowd (50,000 passengers at station)
  T=30   → 20:22  Prayagraj Special platform change announced — surge begins
  T=60   → 20:30  FOB-3 critical; Prayagraj Express passengers panic from name confusion
  T=75   → 20:34  JANKAVACH L1 fires: "FOB-3 density exceeds 5.0/m² — PA alert"
  T=105  → 20:40  JANKAVACH L2 fires: "Deploy marshals, halt FOB-3 access"
  T=188  → 20:48  CRUSH (human timeline only — CrowdGuard prevented this)
  T=252  → 22:40  Fire tenders arrive (human "response")
  T=300  → End
"""
import time
from config.store import config_store

# ── CrowdGuard keyframes (JanKavach intervenes at T=75, saves lives) ─────────────
_KF_CROWDGUARD = {
    # T=0  20:15 IST — Elevated crowd, 50k passengers at station, trains delayed
    0: {
        "CONC":   3.8,  # 50k people in station — already above normal
        "GATE_A": 2.5,  "GATE_B": 4.2,  "GATE_C": 1.8,
        "FOB1":   3.5,  # FOB-3: moderately busy (P14/P15 stairway)
        "FOB2":   2.8,
        "P1":     4.5,  # Pf 12: Prayagraj Special originally here, packed
        "P2":     2.8,  # Pf 13: Swatantrata Senani Express (delayed)
        "P3":     3.5,  # Pf 14: Prayagraj Express (delayed, passengers waiting)
        "P4":     2.5,  # Pf 15: Rajdhani (delayed, blocking passage)
        "P5":     1.5,  # Pf 16: mostly empty (Prayagraj Special not yet moved here)
        "P6":     2.0,
    },

    # T=30  20:22 IST — Announcement: Prayagraj Special moved Pf 12 → Pf 16
    # Crowd from P12 surges toward P16; P14 passengers panic hearing "Prayagraj"
    30: {
        "CONC":   4.5,
        "GATE_A": 2.8,  "GATE_B": 5.5,  "GATE_C": 2.2,
        "FOB1":   5.8,  # FOB-3: WARNING — both P12→P16 and P14 panic surge using it
        "FOB2":   3.5,
        "P1":     2.2,  # Pf 12: emptying (Prayagraj Special gone)
        "P2":     3.0,
        "P3":     5.5,  # Pf 14: panic — passengers think THEIR train moved
        "P4":     3.0,
        "P5":     5.8,  # Pf 16: receiving mass surge from Pf 12 migration
        "P6":     2.2,
    },

    # T=60  20:30 IST — Crisis peak before intervention
    60: {
        "CONC":   5.2,
        "GATE_A": 3.0,  "GATE_B": 6.5,  "GATE_C": 2.5,
        "FOB1":   7.8,  # FOB-3: CRITICAL — approaching crush density
        "FOB2":   4.0,
        "P1":     1.8,
        "P2":     3.2,
        "P3":     6.8,  # Pf 14: CRITICAL (feeds FOB-3 from below)
        "P4":     3.5,
        "P5":     7.0,  # Pf 16: CRITICAL (destination of surge)
        "P6":     2.5,
    },

    # T=75  20:34 IST — L1 fires: PA system alert, marshals mobilised
    75: {
        "CONC":   5.5,
        "GATE_A": 3.2,  "GATE_B": 7.0,  "GATE_C": 2.8,
        "FOB1":   8.5,  # L1 trigger (>5.0 threshold hit at T=30, alert fires now)
        "FOB2":   4.2,
        "P1":     1.5,
        "P2":     3.5,
        "P3":     7.2,
        "P4":     3.8,
        "P5":     7.5,
        "P6":     2.8,
    },

    # T=105  20:40 IST — L2: FOB-3 access halted, crowd diverted via FOB-2 + Ajmeri Gate
    # Density begins falling due to JanKavach intervention
    105: {
        "CONC":   4.5,
        "GATE_A": 4.5,  # crowd redirected here
        "GATE_B": 5.0,  "GATE_C": 4.0,
        "FOB1":   5.5,  # dropping — marshals halted new entries
        "FOB2":   5.5,  # rising — diversion route now in use
        "P1":     1.5,
        "P2":     3.0,
        "P3":     5.0,  # falling — passengers redirected
        "P4":     3.2,
        "P5":     5.5,
        "P6":     2.5,
    },

    # T=150  20:50 IST — Situation stabilising after intervention
    150: {
        "CONC":   3.5,
        "GATE_A": 3.5,  "GATE_B": 3.8,  "GATE_C": 3.0,
        "FOB1":   3.5,  "FOB2":   4.0,
        "P1":     1.5,
        "P2":     2.5,
        "P3":     3.5,
        "P4":     2.8,
        "P5":     4.0,
        "P6":     2.2,
    },

    # T=210  21:05 IST — Controlled dispersal, all clear
    210: {
        "CONC":   2.8,
        "GATE_A": 2.5,  "GATE_B": 3.0,  "GATE_C": 2.5,
        "FOB1":   2.5,  "FOB2":   3.0,
        "P1":     1.5,
        "P2":     2.0,
        "P3":     2.5,
        "P4":     2.0,
        "P5":     3.0,
        "P6":     1.8,
    },

    # T=300  — Normal operations resumed
    300: {
        "CONC":   2.0,
        "GATE_A": 1.8,  "GATE_B": 2.2,  "GATE_C": 1.5,
        "FOB1":   1.8,  "FOB2":   2.0,
        "P1":     1.5, "P2": 1.8, "P3": 2.0, "P4": 1.8, "P5": 2.2, "P6": 1.5,
    },
}

# ── Human-operated keyframes (no intervention until T=252 — too late) ──────────
# Identical to CrowdGuard up to T=75, then diverges catastrophically
_KF_HUMAN = {
    0:  _KF_CROWDGUARD[0].copy(),
    30: _KF_CROWDGUARD[30].copy(),
    60: _KF_CROWDGUARD[60].copy(),
    75: _KF_CROWDGUARD[75].copy(),   # same reading at L1 time — but humans ignore it

    # No intervention — density keeps climbing
    105: {
        "CONC":   6.0,
        "GATE_A": 3.5,  "GATE_B": 8.0,  "GATE_C": 3.0,
        "FOB1":   9.5,  # lethal density — well above 8.0/m² crush threshold
        "FOB2":   4.5,
        "P1":     1.5,
        "P2":     3.8,
        "P3":     8.5,  # Pf 14 — feeding FOB-3
        "P4":     4.0,
        "P5":     8.0,  # Pf 16 — receiving crush
        "P6":     2.8,
    },

    # T=188  20:48 IST — THE CRUSH: headload falls on FOB-3 stairway
    # 18 killed, 15 injured. Traumatic asphyxia. Youngest victim: 7-year-old girl.
    188: {
        "CONC":   6.5,
        "GATE_A": 4.0,  "GATE_B": 9.0,  "GATE_C": 3.5,
        "FOB1":   10.8, # peak crush density — people falling, piling up on stairs
        "FOB2":   5.0,
        "P1":     1.5,
        "P2":     4.5,
        "P3":     9.5,
        "P4":     4.5,
        "P5":     8.5,
        "P6":     3.0,
    },

    # T=252  ~22:40 IST — Fire tenders finally arrive (67min after crush, 112min after incident)
    # Railway denied stampede ("only a rumour") until 1:09 AM next day
    252: {
        "CONC":   5.5,
        "GATE_A": 3.0,  "GATE_B": 7.5,  "GATE_C": 3.0,
        "FOB1":   8.0,  # still critical — 4 fire tenders managing a crushed crowd
        "FOB2":   4.5,
        "P1":     1.5,
        "P2":     4.0,
        "P3":     7.5,
        "P4":     4.0,
        "P5":     7.0,
        "P6":     2.8,
    },

    300: {
        "CONC":   4.5,
        "GATE_A": 2.5,  "GATE_B": 5.5,  "GATE_C": 2.5,
        "FOB1":   5.5,  "FOB2":   3.5,
        "P1":     1.5, "P2": 3.0, "P3": 5.5, "P4": 3.5, "P5": 5.0, "P6": 2.5,
    },
}

CRUSH_TIME_HUMAN   = 188   # T=188s — real 20:48 IST, 18 dead
HUMAN_RESPONSE_TIME = 252  # T=252s — fire tenders arrive ~22:40 IST
L1_FIRE_TIME       = 75    # T=75s  — JanKavach L1 at 20:34 IST (14 min before crush)
SCENARIO_DURATION  = 300


def _interpolate(kf: dict, t: float) -> dict[str, float]:
    times = sorted(kf.keys())
    if t <= times[0]:
        return kf[times[0]].copy()
    if t >= times[-1]:
        return kf[times[-1]].copy()
    for i in range(len(times) - 1):
        t0, t1 = times[i], times[i + 1]
        if t0 <= t <= t1:
            alpha = (t - t0) / (t1 - t0)
            smooth = alpha * alpha * (3 - 2 * alpha)  # ease-in-out
            return {
                zone: round(kf[t0][zone] + (kf[t1][zone] - kf[t0][zone]) * smooth, 2)
                for zone in kf[t0]
            }
    return kf[times[-1]].copy()


def get_frame(elapsed: float, mode: str = "crowdguard") -> dict:
    kf = _KF_CROWDGUARD if mode == "crowdguard" else _KF_HUMAN
    densities = _interpolate(kf, elapsed)
    config = config_store.get()
    zones = {}
    for zone_id, density in densities.items():
        zone = config.zone_by_id(zone_id)
        # Fallback keeps the scripted NDLS replay running even if this zone
        # id was deleted from config — see spec §2 non-goals: the scenario
        # timeline is a fixed historical reenactment, not user-configured.
        area = zone.area_m2 if zone else 100.0
        name = zone.label if zone else zone_id
        zones[zone_id] = {
            "density": density,
            "count": int(density * area),
            "color": config.density_color(density),
            "name": name,
            "flow_vector": _flow_for(zone_id, density, elapsed),
        }
    return zones


def _flow_for(zone_id: str, density: float, t: float) -> dict:
    # T=30-75: surge phase — crowd moving from P12 toward P16 via FOB-3
    if 30 < t < 75:
        if zone_id in ("P3", "P1"):
            return {"dx": 0.0, "dy": -0.9, "magnitude": 0.9}  # toward FOB-3
        if zone_id == "FOB1":
            return {"dx": 0.2, "dy": -0.7, "magnitude": min(density / 8.0, 1.0)}
        if zone_id == "P5":
            return {"dx": 0.0, "dy": 0.5, "magnitude": 0.6}   # P16 receiving
    # Post-L1 (CrowdGuard): crowd dispersing via FOB-2 and Ajmeri Gate
    if t > 90 and zone_id in ("FOB1", "P3"):
        return {"dx": 0.4, "dy": 0.5, "magnitude": 0.5}
    if t > 90 and zone_id == "GATE_A":
        return {"dx": 0.5, "dy": 0.3, "magnitude": 0.4}
    return {"dx": 0.0, "dy": 0.0, "magnitude": 0.0}


class ScenarioRunner:
    def __init__(self, speed: float = 2.0):
        self._start: float | None = None
        self._speed = speed

    def set_speed(self, speed: float):
        self._speed = speed

    def elapsed(self) -> float:
        if self._start is None:
            self._start = time.time()
        return (time.time() - self._start) * self._speed

    def reset(self):
        self._start = None

    def is_crush_time(self) -> bool:
        return self.elapsed() >= CRUSH_TIME_HUMAN

    def is_complete(self) -> bool:
        return self.elapsed() >= SCENARIO_DURATION
