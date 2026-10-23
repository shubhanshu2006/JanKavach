"""Pytest configuration and fixtures for API tests."""
import pytest
from pathlib import Path
from config.store import config_store
from config.defaults import DEFAULT_CONFIG
from config.schema import StationConfig


@pytest.fixture(autouse=True)
def reset_config_to_default():
    """Reset config to defaults (version 1) before each test to ensure clean state."""
    # Directly set to default config with version 1 to avoid version incrementing
    config_path = Path(__file__).parent.parent / "config" / "station.config.json"
    config_path.parent.mkdir(parents=True, exist_ok=True)

    default_with_version = StationConfig(
        **DEFAULT_CONFIG.model_dump(exclude={"version"}),
        version=1
    )
    config_path.write_text(default_with_version.model_dump_json(indent=2))

    # Reload the config store to pick up the reset version
    config_store._current = default_with_version.model_copy(deep=True)

    yield
