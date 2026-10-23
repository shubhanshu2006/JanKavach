import pytest
from vision.tracker import ZoneTracker
from config.store import config_store
from config.schema import ZoneConfig
from prediction.extrapolator import Extrapolator


@pytest.fixture(autouse=True)
def restore_config():
    yield
    config_store.reset()


def test_tracker_uses_configured_area_for_density():
    original = config_store.get()
    changed = original.model_copy(deep=True)
    changed.zone_by_id("FOB1").area_m2 = 10.0  # was 80.0
    config_store.update(changed)

    tracker = ZoneTracker()
    states = tracker.update({"FOB1": 50})
    assert states["FOB1"]["density"] == 5.0  # 50 / 10.0, not 50 / 80.0


def test_tracker_new_zone_is_supported_without_preseeding():
    original = config_store.get()
    with_new_zone = original.model_copy(deep=True)
    with_new_zone.zones.append(
        ZoneConfig(id="TEST_ZONE", label="Test", short_label="Test",
                   category_id="concourse", area_m2=50.0)
    )
    with_new_zone.view.zone_display_order.append("TEST_ZONE")
    config_store.update(with_new_zone)

    tracker = ZoneTracker()
    states = tracker.update({"TEST_ZONE": 25})
    assert states["TEST_ZONE"]["density"] == 0.5


def test_extrapolator_iterates_configured_zones_only():
    original = config_store.get()
    trimmed = original.model_copy(deep=True)
    trimmed.zones = [z for z in trimmed.zones if z.id in ("CONC", "FOB1")]
    trimmed.categories = original.categories
    trimmed.view.zone_display_order = ["CONC", "FOB1"]
    config_store.update(trimmed)

    predictions = Extrapolator().predict({"CONC": {"density": 4.0}, "FOB1": {"density": 5.0}}, {})
    assert set(predictions.keys()) == {"CONC", "FOB1"}
