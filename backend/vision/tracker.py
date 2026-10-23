"""
Computes per-zone density (persons/m²) and flow vectors from raw person counts.
"""
from collections import deque
from config.store import config_store

HISTORY_LEN = 15


class ZoneTracker:
    def __init__(self):
        self._history: dict[str, deque[float]] = {}

    def update(self, counts: dict[str, int]) -> dict:
        """
        Accepts raw person counts per zone.
        Returns zone state dict ready for broadcast.
        """
        config = config_store.get()
        zone_states = {}

        for zone_id, count in counts.items():
            zone = config.zone_by_id(zone_id)
            area = zone.area_m2 if zone else 1.0
            density = count / area
            self._history.setdefault(zone_id, deque(maxlen=HISTORY_LEN)).append(density)

            flow = self._flow_vector(zone_id)
            zone_states[zone_id] = {
                "density": round(density, 2),
                "count": count,
                "color": config.density_color(density),
                "name": zone.label if zone else zone_id,
                "flow_vector": flow,
            }

        return zone_states

    def _flow_vector(self, zone_id: str) -> dict:
        hist = list(self._history[zone_id])
        if len(hist) < 3:
            return {"dx": 0.0, "dy": 0.0, "magnitude": 0.0}

        recent = sum(hist[-3:]) / 3
        older = sum(hist[:3]) / 3
        delta = recent - older
        magnitude = min(abs(delta) / 2.0, 1.0)

        # dy encodes increasing (crowd moving in) vs decreasing (crowd dispersing)
        dy = 1.0 if delta > 0 else -1.0
        return {"dx": 0.0, "dy": round(dy * magnitude, 3), "magnitude": round(magnitude, 3)}

    def density_history(self, zone_id: str) -> list[float]:
        return list(self._history[zone_id])
