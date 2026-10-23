"""
Graded intervention decision engine.
L1 (PA/signage — zero physical force) fires immediately, framed as a duty officer's
existing authority executed faster than manual relay. L2 (escalator/gate — mechanical
actions) and L3 (platform closure) always require an explicit operator confirm; neither
ever auto-fires.
"""
import time
from config.store import config_store
from decision.interventions import (
    Intervention, Level,
    L1_ACTIONS, L2_ACTIONS, L3_ACTIONS,
    PRE_WARN_ACTIONS, SOS_ACTIONS,
)


def _zone_label(config, zone_id: str) -> str:
    zone = config.zone_by_id(zone_id)
    return zone.label if zone else zone_id


class DecisionEngine:
    def __init__(self, max_level: int = 5):
        self._max_level = max_level             # cap — levels above this are skipped
        self._fired: set[str] = set()           # zone+level keys already actioned
        self._staged: dict[str, dict] = {}      # L2/L3 interventions pending
        self._pre_warn_zones: set[str] = set()  # zones where PRE_WARN already fired

    def set_max_level(self, max_level: int) -> None:
        self._max_level = max_level

    def evaluate(self, zone_states: dict, predictions: dict) -> list[Intervention]:
        """
        Evaluate current + predicted zone states.
        Returns list of new interventions to broadcast.
        """
        config = config_store.get()
        t = config.thresholds
        new_interventions: list[Intervention] = []
        t_start = time.perf_counter()

        for zone_id, state in zone_states.items():
            density = state["density"]
            pred_90 = predictions.get(zone_id, {}).get("t90", {}).get("density", 0.0)
            key_l1       = f"{zone_id}_L1"
            key_l2       = f"{zone_id}_L2"
            key_l3       = f"{zone_id}_L3"
            key_pre_warn = f"{zone_id}_PRE_WARN"
            key_sos      = f"{zone_id}_SOS"

            # L1: fires immediately, once per zone session — informational only
            if (self._max_level >= 1
                    and density >= t.l1_trigger
                    and key_l1 not in self._fired):
                if zone_id in L1_ACTIONS:
                    action_label, action_msg = L1_ACTIONS[zone_id]
                else:
                    label = _zone_label(config, zone_id)
                    action_label, action_msg = (
                        "PA Alert",
                        f"{label} is experiencing heavy congestion. "
                        "Passengers please use an alternate route.",
                    )
                iv = Intervention(
                    zone=zone_id,
                    level=Level.L1,
                    trigger=f"Density {density:.1f}/m² crossed L1 threshold",
                    action=f"{action_label}: \"{action_msg}\"",
                    status="fired",
                    response_time_ms=(time.perf_counter() - t_start) * 1000,
                )
                self._fired.add(key_l1)
                new_interventions.append(iv)

            # L2: stage when density crosses L2 threshold
            if (self._max_level >= 2
                    and density >= t.l2_trigger
                    and key_l2 not in self._fired
                    and key_l2 not in self._staged):
                if zone_id in L2_ACTIONS:
                    action = L2_ACTIONS[zone_id]
                else:
                    label = _zone_label(config, zone_id)
                    action = f"{label} congestion reduction measures staged — requires operator confirmation."
                iv = Intervention(
                    zone=zone_id,
                    level=Level.L2,
                    trigger=f"Density {density:.1f}/m² — L2 threshold crossed",
                    action=action,
                    status="staged",
                    countdown_remaining=t.l2_countdown_seconds,
                )
                self._staged[key_l2] = {"iv": iv, "staged_at": time.time()}
                new_interventions.append(iv)

            # L3: stage when predicted density in 90s is lethal. Also require the
            # CURRENT density to have already reached PRE-WARN (the rung directly
            # below L3) — the 90s-ahead forecast is a linear rate projection with a
            # hard "+5.0" ceiling, so a brief early uptick from a calm baseline can
            # otherwise satisfy pred_90 before the situation is even at L1 yet,
            # staging a platform closure before the PA alert / gate throttle that
            # are supposed to precede it. (Checked against the threshold value, not
            # "has PRE-WARN fired", so an L3-capped demo run — max_level=3, which
            # never evaluates the PRE-WARN branch below — can still reach L3.)
            if (self._max_level >= 3
                    and pred_90 >= t.l3_trigger
                    and density >= t.pre_warn_trigger
                    and key_l3 not in self._fired
                    and key_l3 not in self._staged):
                if zone_id in L3_ACTIONS:
                    action = L3_ACTIONS[zone_id]
                else:
                    label = _zone_label(config, zone_id)
                    action = f"{label} closure recommended. Requires confirmation."
                iv = Intervention(
                    zone=zone_id,
                    level=Level.L3,
                    trigger=f"Predicted density {pred_90:.1f}/m² in 90s — critical forecast",
                    action=action,
                    status="pending_confirm",
                )
                self._staged[key_l3] = {"iv": iv, "staged_at": time.time()}
                new_interventions.append(iv)

            # PRE_WARN: auto-fire standby alert when density hits pre-warn threshold
            if (self._max_level >= 4
                    and density >= t.pre_warn_trigger
                    and key_pre_warn not in self._fired):
                if zone_id in PRE_WARN_ACTIONS:
                    label_tag, msg = PRE_WARN_ACTIONS[zone_id]
                else:
                    zone_label = _zone_label(config, zone_id)
                    label_tag, msg = (
                        "STANDBY ALERT",
                        f"Density critical at {zone_label}. RPF, Police, Fire Brigade & Ambulance "
                        "placed on standby. Prepare emergency response teams.",
                    )
                iv = Intervention(
                    zone=zone_id,
                    level=Level.PRE_WARN,
                    trigger=f"Density {density:.1f}/m² — pre-warn threshold crossed",
                    action=f"{label_tag}: {msg}",
                    status="fired",
                    response_time_ms=(time.perf_counter() - t_start) * 1000,
                )
                self._fired.add(key_pre_warn)
                self._pre_warn_zones.add(zone_id)
                new_interventions.append(iv)

            # SOS: auto-fire full emergency dispatch only AFTER pre-warn has already fired for this zone
            if (self._max_level >= 5
                    and density >= t.failsafe_trigger
                    and zone_id in self._pre_warn_zones
                    and key_sos not in self._fired):
                if zone_id in SOS_ACTIONS:
                    label_tag, msg = SOS_ACTIONS[zone_id]
                else:
                    zone_label = _zone_label(config, zone_id)
                    label_tag, msg = (
                        "EMERGENCY DISPATCH",
                        f"CRUSH IMMINENT — {zone_label}. RPF deployed. Police 100 called. "
                        "Fire Brigade 101 dispatched. Ambulance 108 requested.",
                    )
                iv = Intervention(
                    zone=zone_id,
                    level=Level.SOS,
                    trigger=f"Density {density:.1f}/m² — LETHAL threshold, PRE-WARN already active for this zone. Emergency dispatch.",
                    action=f"{label_tag}: {msg}",
                    status="fired",
                    response_time_ms=(time.perf_counter() - t_start) * 1000,
                )
                self._fired.add(key_sos)
                new_interventions.append(iv)

        # L2 items never auto-execute — countdown_remaining counts elapsed time pending
        # (capped) purely as an urgency indicator for the operator. Only confirm()/cancel()
        # resolve a staged L2 item.
        now = time.time()
        for key, entry in list(self._staged.items()):
            if "_L2" in key:
                elapsed = now - entry["staged_at"]
                entry["iv"].countdown_remaining = min(t.l2_countdown_seconds, int(elapsed))

        return new_interventions

    def confirm(self, intervention_id: str):
        for key, entry in list(self._staged.items()):
            if entry["iv"].id == intervention_id:
                entry["iv"].status = "confirmed"
                self._fired.add(key)
                del self._staged[key]
                return True
        return False

    def cancel(self, intervention_id: str):
        for key, entry in list(self._staged.items()):
            if entry["iv"].id == intervention_id:
                entry["iv"].status = "cancelled"
                self._fired.add(key)
                del self._staged[key]
                return True
        return False

    def get_staged(self) -> list[Intervention]:
        return [entry["iv"] for entry in self._staged.values()]

    def reset(self):
        self._fired.clear()
        self._staged.clear()
        self._pre_warn_zones.clear()
