"""
Loads/persists the running StationConfig. A single process-wide instance
(`config_store` below) is what every consuming module reads from — see
docs/superpowers/specs/2026-08-22-onboarding-nocode-config-design.md §5.2.
"""
import os
import tempfile
from pathlib import Path

from config.defaults import DEFAULT_CONFIG
from config.schema import StationConfig, StationConfigInput


class ConfigStore:
    def __init__(self, path: Path):
        self._path = path
        self._current = self._load_or_seed()

    def get(self) -> StationConfig:
        return self._current

    def update(self, data: StationConfigInput) -> StationConfig:
        # exclude={"version"} is a no-op for a bare StationConfigInput (it has no
        # such field) and strips a stale one if a full StationConfig was passed in
        # (e.g. a caller did `cfg = config_store.get(); cfg.thresholds.x = 1;
        # config_store.update(cfg)`) — without this, **dump would collide with
        # the explicit version= kwarg below and raise a TypeError.
        updated = StationConfig(
            **data.model_dump(exclude={"version"}), version=self._current.version + 1
        )
        self._save(updated)
        self._current = updated
        return updated

    def reset(self) -> StationConfig:
        restored = StationConfig(
            **DEFAULT_CONFIG.model_dump(exclude={"version"}),
            version=self._current.version + 1,
        )
        self._save(restored)
        self._current = restored
        return restored

    def _load_or_seed(self) -> StationConfig:
        if self._path.exists():
            return StationConfig.model_validate_json(self._path.read_text())
        self._save(DEFAULT_CONFIG)
        # Return a deep copy, not the DEFAULT_CONFIG singleton itself — get()
        # hands this object out to callers, and update()'s documented pattern
        # (`cfg = config_store.get(); cfg.thresholds.x = 1; config_store.update(cfg)`)
        # would otherwise mutate the process-wide DEFAULT_CONFIG in place,
        # silently corrupting the "restore to NDLS defaults" guarantee that
        # reset() relies on.
        return DEFAULT_CONFIG.model_copy(deep=True)

    def _save(self, config: StationConfig) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp_path = tempfile.mkstemp(dir=self._path.parent, suffix=".tmp")
        try:
            with os.fdopen(fd, "w") as f:
                f.write(config.model_dump_json(indent=2))
            os.replace(tmp_path, self._path)
        except Exception:
            os.unlink(tmp_path)
            raise


config_store = ConfigStore(Path(__file__).parent / "station.config.json")
