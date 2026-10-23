import pytest
from demo.scenario_runner import get_frame
from config.store import config_store


@pytest.fixture(autouse=True)
def restore_config():
    yield
    config_store.reset()


def test_get_frame_uses_configured_label():
    original = config_store.get()
    relabeled = original.model_copy(deep=True)
    relabeled.zone_by_id("FOB1").label = "Renamed Stairway"
    config_store.update(relabeled)

    frame = get_frame(0.0, mode="crowdguard")
    assert frame["FOB1"]["name"] == "Renamed Stairway"


def test_get_frame_falls_back_gracefully_if_scenario_zone_deleted():
    original = config_store.get()
    without_p6 = original.model_copy(deep=True)
    without_p6.zones = [z for z in without_p6.zones if z.id != "P6"]
    without_p6.view.zone_display_order = [
        zid for zid in without_p6.view.zone_display_order if zid != "P6"
    ]
    config_store.update(without_p6)

    frame = get_frame(0.0, mode="crowdguard")
    assert frame["P6"]["name"] == "P6"
    assert frame["P6"]["count"] >= 0
