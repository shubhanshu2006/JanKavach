"""
The NDLS Feb-15-2025 station layout, as a StationConfig. This is what
ships out of the box and what "Reset to NDLS defaults" restores — it must
reproduce today's hardcoded constants.py / constants.ts values exactly.
"""
from config.schema import (
    ZoneConfig, CategoryConfig, ThresholdConfig, ViewConfig, StationConfig,
)

_CATEGORIES = [
    CategoryConfig(id="concourse", label="Concourse", color="#3B82F6"),
    CategoryConfig(id="gate", label="Gate", color="#A78BFA"),
    CategoryConfig(id="fob", label="Foot Over Bridge", color="#FB923C"),
    CategoryConfig(id="platform", label="Platform", color="#22D3EE"),
]

_ZONES = [
    ZoneConfig(id="CONC", label="Main Concourse (NDLS)", short_label="Concourse",
               category_id="concourse", area_m2=1200.0),
    ZoneConfig(id="GATE_A", label="Ajmeri Gate Entry", short_label="Ajmeri Gt",
               category_id="gate", area_m2=60.0),
    ZoneConfig(id="GATE_B", label="Paharganj Gate Entry", short_label="Paharganj",
               category_id="gate", area_m2=60.0),
    ZoneConfig(id="GATE_C", label="FOB-1 Exit Corridor", short_label="FOB-1 Exit",
               category_id="gate", area_m2=60.0),
    ZoneConfig(id="FOB1", label="FOB-3 Stairway (Pf 14/15)", short_label="FOB-3",
               category_id="fob", area_m2=80.0),
    ZoneConfig(id="FOB2", label="FOB-2 Stairway (Pf 12/13)", short_label="FOB-2",
               category_id="fob", area_m2=80.0),
    ZoneConfig(id="P1", label="Platform 12 — Prayagraj Spl", short_label="Pf 12",
               category_id="platform", area_m2=500.0),
    ZoneConfig(id="P2", label="Platform 13 — Swatantrata Exp", short_label="Pf 13",
               category_id="platform", area_m2=500.0),
    ZoneConfig(id="P3", label="Platform 14 — Prayagraj Exp", short_label="Pf 14",
               category_id="platform", area_m2=500.0),
    ZoneConfig(id="P4", label="Platform 15 — Rajdhani", short_label="Pf 15",
               category_id="platform", area_m2=500.0),
    ZoneConfig(id="P5", label="Platform 16 — Prayagraj Spl", short_label="Pf 16",
               category_id="platform", area_m2=500.0),
    ZoneConfig(id="P6", label="Platform 11", short_label="Pf 11",
               category_id="platform", area_m2=500.0),
]

_THRESHOLDS = ThresholdConfig(
    density_safe=3.0, density_warning=5.0, density_critical=6.0,
    l1_trigger=5.0, l2_trigger=6.0, l3_trigger=7.5,
    pre_warn_trigger=7.0, failsafe_trigger=8.0, l2_countdown_seconds=10,
)

_VIEW = ViewConfig(zone_display_order=[z.id for z in _ZONES])

DEFAULT_CONFIG = StationConfig(
    zones=_ZONES,
    categories=_CATEGORIES,
    thresholds=_THRESHOLDS,
    view=_VIEW,
    presets=[],
    video_width=640,
    video_height=480,
    version=1,
)
