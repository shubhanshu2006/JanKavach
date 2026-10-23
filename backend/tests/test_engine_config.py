import pytest
from decision.engine import DecisionEngine
from config.store import config_store
from config.schema import ZoneConfig


@pytest.fixture(autouse=True)
def restore_config():
    yield
    config_store.reset()


def test_l1_fires_at_configured_threshold_not_hardcoded_one():
    original = config_store.get()
    lowered = original.model_copy(deep=True)
    lowered.thresholds.l1_trigger = 1.0
    config_store.update(lowered)

    engine = DecisionEngine()
    fired = engine.evaluate({"FOB1": {"density": 1.5}}, {})
    assert any(iv.level.name == "L1" for iv in fired)


def test_l1_does_not_fire_below_configured_threshold():
    original = config_store.get()
    raised = original.model_copy(deep=True)
    raised.thresholds.l1_trigger = 20.0
    # l2_trigger must stay >= l1_trigger per ThresholdConfig.check_ordering (Task 2),
    # so it's raised too — the test only asserts on L1 firing, so this is neutral.
    raised.thresholds.l2_trigger = 25.0
    config_store.update(raised)

    engine = DecisionEngine()
    fired = engine.evaluate({"FOB1": {"density": 15.0}}, {})
    assert not any(iv.level.name == "L1" for iv in fired)


def test_new_zone_without_custom_copy_gets_generic_fallback_l1_message():
    original = config_store.get()
    with_new_zone = original.model_copy(deep=True)
    with_new_zone.zones.append(
        ZoneConfig(id="TEST_ZONE", label="Test Waiting Hall", short_label="Test",
                   category_id="concourse", area_m2=100.0)
    )
    with_new_zone.view.zone_display_order.append("TEST_ZONE")
    config_store.update(with_new_zone)

    engine = DecisionEngine()
    fired = engine.evaluate({"TEST_ZONE": {"density": 5.5}}, {})
    l1 = [iv for iv in fired if iv.level.name == "L1"]
    assert len(l1) == 1
    assert "Test Waiting Hall" in l1[0].action


def test_l2_countdown_uses_configured_seconds():
    original = config_store.get()
    changed = original.model_copy(deep=True)
    changed.thresholds.l2_countdown_seconds = 3
    config_store.update(changed)

    engine = DecisionEngine()
    engine.evaluate({"FOB1": {"density": 6.5}}, {})

    # countdown_remaining tracks elapsed time since staging, capped at the
    # configured seconds (see evaluate()'s finalize loop) — right after staging,
    # elapsed is ~0 regardless of the cap, so that instant can't distinguish a
    # configured cap of 3 from the old hardcoded default of 10. Advance the
    # recorded staged_at to simulate 5 elapsed seconds (> configured cap of 3,
    # < old hardcoded default of 10) and re-run evaluate() so the real capping
    # logic executes against genuinely elapsed time: a config-driven cap of 3
    # caps the result at 3, while a hardcoded cap of 10 would leave it at 5.
    engine._staged["FOB1_L2"]["staged_at"] -= 5
    engine.evaluate({}, {})

    l2 = [iv for iv in engine.get_staged() if iv.level.name == "L2"]
    assert len(l2) == 1
    assert l2[0].countdown_remaining == 3


def test_l3_fallback_stages_as_pending_confirm_and_never_auto_fires():
    original = config_store.get()
    with_new_zone = original.model_copy(deep=True)
    with_new_zone.zones.append(
        ZoneConfig(id="L3_ZONE", label="Test L3 Waiting Hall", short_label="L3 Zone",
                   category_id="concourse", area_m2=100.0)
    )
    with_new_zone.view.zone_display_order.append("L3_ZONE")
    config_store.update(with_new_zone)

    engine = DecisionEngine()
    t = config_store.get().thresholds
    # L3 is driven by predicted density (t90), not current density — keep current
    # density at 0 so only the L3 (fallback) path is exercised, isolating it from
    # L1/L2/PRE_WARN/SOS.
    predictions = {"L3_ZONE": {"t90": {"density": t.l3_trigger + 1.0}}}

    fired = engine.evaluate({"L3_ZONE": {"density": 0.0}}, predictions)
    l3 = [iv for iv in fired if iv.level.name == "L3"]
    assert len(l3) == 1
    assert l3[0].status == "pending_confirm"
    assert "Test L3 Waiting Hall" in l3[0].action

    # A second evaluate() call with the same still-critical prediction must not
    # auto-fire the staged item, flip its status, or stage a duplicate — L3 always
    # requires an explicit confirm() regardless of custom-copy vs. fallback text.
    fired_again = engine.evaluate({"L3_ZONE": {"density": 0.0}}, predictions)
    assert not any(iv.level.name == "L3" for iv in fired_again)

    staged = [iv for iv in engine.get_staged() if iv.level.name == "L3"]
    assert len(staged) == 1
    assert staged[0].status == "pending_confirm"


def test_sos_fallback_blocked_without_prior_pre_warn_in_pre_warn_zones():
    original = config_store.get()
    with_new_zone = original.model_copy(deep=True)
    with_new_zone.zones.append(
        ZoneConfig(id="SOS_ZONE", label="Test SOS Waiting Hall", short_label="SOS Zone",
                   category_id="concourse", area_m2=100.0)
    )
    with_new_zone.view.zone_display_order.append("SOS_ZONE")
    config_store.update(with_new_zone)

    engine = DecisionEngine()
    t = config_store.get().thresholds
    assert t.pre_warn_trigger < t.failsafe_trigger  # sanity: NDLS defaults keep these distinct

    # Tick 1: a real PRE_WARN fires for this zone (density crosses pre_warn_trigger
    # but stays below failsafe_trigger, so SOS's own density gate cannot be met yet —
    # this tick only seeds _pre_warn_zones via the engine's real firing path).
    fired = engine.evaluate({"SOS_ZONE": {"density": t.pre_warn_trigger}}, {})
    assert any(iv.level.name == "PRE_WARN" for iv in fired)
    assert "SOS_ZONE" in engine._pre_warn_zones

    # Given the NDLS default config, density crossing failsafe_trigger always also
    # crosses pre_warn_trigger (schema enforces pre_warn_trigger <= failsafe_trigger),
    # and evaluate() runs the PRE_WARN block before the SOS block within the same
    # per-zone iteration — so through normal usage alone, PRE_WARN always populates
    # _pre_warn_zones before SOS's guard is ever checked, making a purely
    # density-driven test of the guard vacuous (it would "pass" the guard whether or
    # not the guard code is even there). To genuinely isolate the SOS block's own
    # "zone_id in self._pre_warn_zones" condition, we remove the zone from
    # _pre_warn_zones here. PRE_WARN itself will NOT re-fire on the next tick (it
    # already fired, so key_pre_warn is in self._fired) and so will not re-populate
    # the set — leaving SOS's other three conditions (max_level, density, not
    # already fired) satisfied while only the guard under test stands in the way.
    # If "zone_id in self._pre_warn_zones" were ever removed from the SOS block,
    # this exact setup would make SOS fire; with the guard intact it must not.
    engine._pre_warn_zones.discard("SOS_ZONE")

    fired = engine.evaluate({"SOS_ZONE": {"density": t.failsafe_trigger}}, {})
    assert not any(iv.level.name == "SOS" for iv in fired)
