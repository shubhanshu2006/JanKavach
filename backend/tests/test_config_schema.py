import pytest
from pydantic import ValidationError

from config.schema import (
    ZoneBounds, ZoneConfig, CategoryConfig, ThresholdConfig,
    ViewConfig, PresetConfig, StationConfigInput, StationConfig,
)


def _thresholds(**overrides):
    base = dict(
        density_safe=3.0, density_warning=5.0, density_critical=6.0,
        l1_trigger=5.0, l2_trigger=6.0, l3_trigger=7.5,
        pre_warn_trigger=7.0, failsafe_trigger=8.0, l2_countdown_seconds=10,
    )
    base.update(overrides)
    return ThresholdConfig(**base)


def _minimal_config(**overrides) -> dict:
    base = dict(
        zones=[
            ZoneConfig(id="CONC", label="Main Concourse", short_label="Concourse",
                       category_id="concourse", area_m2=1200.0),
            ZoneConfig(id="P1", label="Platform 1", short_label="Pf 1",
                       category_id="platform", area_m2=500.0),
        ],
        categories=[
            CategoryConfig(id="concourse", label="Concourse", color="#3B82F6"),
            CategoryConfig(id="platform", label="Platform", color="#22D3EE"),
        ],
        thresholds=_thresholds(),
        view=ViewConfig(zone_display_order=["CONC", "P1"]),
        presets=[],
    )
    base.update(overrides)
    return base


def test_valid_config_round_trips():
    cfg = StationConfig(**_minimal_config(), version=1)
    assert cfg.zone_by_id("P1").label == "Platform 1"
    assert cfg.zone_by_id("MISSING") is None


def test_density_color_matches_existing_thresholds():
    cfg = StationConfig(**_minimal_config(), version=1)
    assert cfg.density_color(2.9) == "green"
    assert cfg.density_color(4.9) == "amber"
    assert cfg.density_color(5.9) == "red"
    assert cfg.density_color(6.0) == "critical"


def test_threshold_ordering_rejected():
    with pytest.raises(ValidationError):
        _thresholds(density_safe=6.0, density_warning=5.0)


def test_l1_must_not_exceed_l2():
    with pytest.raises(ValidationError):
        _thresholds(l1_trigger=6.5, l2_trigger=6.0)


def test_unknown_category_rejected():
    bad = _minimal_config()
    bad["zones"][1] = ZoneConfig(id="P1", label="Platform 1", short_label="Pf 1",
                                  category_id="does-not-exist", area_m2=500.0)
    with pytest.raises(ValidationError):
        StationConfigInput(**bad)


def test_duplicate_zone_ids_rejected():
    bad = _minimal_config()
    bad["zones"][1] = ZoneConfig(id="CONC", label="Dup", short_label="Dup",
                                  category_id="platform", area_m2=1.0)
    with pytest.raises(ValidationError):
        StationConfigInput(**bad)


def test_zone_display_order_must_be_permutation():
    bad = _minimal_config()
    bad["view"] = ViewConfig(zone_display_order=["CONC"])  # missing P1
    with pytest.raises(ValidationError):
        StationConfigInput(**bad)


def test_empty_zone_id_rejected():
    with pytest.raises(ValidationError):
        ZoneConfig(id="", label="Empty Zone", short_label="EZ",
                   category_id="platform", area_m2=100.0)


from config.defaults import DEFAULT_CONFIG

EXPECTED_ZONE_IDS = {
    "CONC", "GATE_A", "GATE_B", "GATE_C", "FOB1", "FOB2",
    "P1", "P2", "P3", "P4", "P5", "P6",
}


def test_default_config_covers_all_ndls_zones():
    assert {z.id for z in DEFAULT_CONFIG.zones} == EXPECTED_ZONE_IDS


def test_default_config_thresholds_match_todays_constants():
    t = DEFAULT_CONFIG.thresholds
    assert (t.density_safe, t.density_warning, t.density_critical) == (3.0, 5.0, 6.0)
    assert (t.l1_trigger, t.l2_trigger, t.l3_trigger) == (5.0, 6.0, 7.5)
    assert (t.pre_warn_trigger, t.failsafe_trigger, t.l2_countdown_seconds) == (7.0, 8.0, 10)


def test_default_config_is_internally_valid():
    # StationConfig's own validators already ran at construction; this just
    # re-confirms the object is what it claims to be.
    assert DEFAULT_CONFIG.zone_by_id("FOB1").area_m2 == 80.0
    assert DEFAULT_CONFIG.zone_by_id("FOB1").category_id == "fob"
