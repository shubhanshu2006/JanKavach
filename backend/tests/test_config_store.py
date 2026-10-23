import json
import pytest
from pydantic import ValidationError

from config.store import ConfigStore
from config.schema import StationConfigInput
from config.defaults import DEFAULT_CONFIG


@pytest.fixture
def store(tmp_path):
    return ConfigStore(tmp_path / "station.config.json")


def test_first_load_seeds_defaults_and_writes_file(store, tmp_path):
    cfg = store.get()
    assert cfg.zones == DEFAULT_CONFIG.zones
    assert (tmp_path / "station.config.json").exists()


def test_update_persists_and_bumps_version(store, tmp_path):
    original = store.get()
    changed_input = StationConfigInput(
        **{**original.model_dump(exclude={"version"}),
           "thresholds": {**original.thresholds.model_dump(), "density_safe": 2.0}},
    )
    updated = store.update(changed_input)
    assert updated.version == original.version + 1
    assert updated.thresholds.density_safe == 2.0

    on_disk = json.loads((tmp_path / "station.config.json").read_text())
    assert on_disk["thresholds"]["density_safe"] == 2.0
    assert on_disk["version"] == updated.version


def test_update_rejects_invalid_threshold_ordering(store):
    original = store.get()
    valid_input = StationConfigInput(**original.model_dump(exclude={"version"}))
    # ThresholdConfig validates ordering eagerly (on construction, via a
    # model_validator), so building an *invalid* StationConfigInput directly
    # would raise before store.update() is ever reached — that would only
    # prove Task 1's schema validator works, not that ConfigStore.update()
    # independently re-validates. Pydantic v2 doesn't validate plain attribute
    # assignment unless validate_assignment is enabled (it isn't here), so
    # mutating the already-constructed object bypasses the constructor-time
    # check and forces invalid data through update()'s own reconstruction
    # path (`StationConfig(**data.model_dump(...), version=...)`), which is
    # what actually needs to be proven to raise.
    valid_input.thresholds.density_safe = 99.0
    with pytest.raises(ValidationError):
        store.update(valid_input)


def test_reset_restores_defaults_and_bumps_version(store):
    original = store.get()
    changed_input = StationConfigInput(
        **{**original.model_dump(exclude={"version"}),
           "thresholds": {**original.thresholds.model_dump(), "density_safe": 2.0}},
    )
    store.update(changed_input)

    restored = store.reset()
    assert restored.zones == DEFAULT_CONFIG.zones
    assert restored.thresholds == DEFAULT_CONFIG.thresholds
    assert restored.version == 3  # 1 (seed) -> 2 (update) -> 3 (reset)


def test_get_from_freshly_seeded_store_does_not_alias_default_config(tmp_path):
    # On first-ever seed (no config file on disk yet), _load_or_seed() must
    # hand out a copy, not the literal DEFAULT_CONFIG singleton imported from
    # config.defaults — otherwise the documented update() pattern
    # (`cfg = store.get(); cfg.thresholds.x = 1; store.update(cfg)`) would
    # mutate the process-wide default in place, corrupting reset() for the
    # rest of the process.
    fresh_store = ConfigStore(tmp_path / "station.config.json")
    cfg = fresh_store.get()
    assert cfg is not DEFAULT_CONFIG

    cfg.thresholds.density_safe = 999.0
    assert DEFAULT_CONFIG.thresholds.density_safe == 3.0  # untouched by the mutation above

    restored = fresh_store.reset()
    assert restored.thresholds.density_safe == 3.0


def test_reload_from_existing_file_does_not_reseed(tmp_path):
    store_a = ConfigStore(tmp_path / "station.config.json")
    changed_input = StationConfigInput(
        **{**store_a.get().model_dump(exclude={"version"}),
           "thresholds": {**store_a.get().thresholds.model_dump(), "density_safe": 2.0}},
    )
    store_a.update(changed_input)

    store_b = ConfigStore(tmp_path / "station.config.json")
    assert store_b.get().thresholds.density_safe == 2.0
