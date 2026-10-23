from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_get_config_returns_default_zones():
    res = client.get("/config")
    assert res.status_code == 200
    body = res.json()
    assert len(body["zones"]) == 12
    assert body["thresholds"]["l1_trigger"] == 5.0


def test_put_config_updates_and_bumps_version():
    current = client.get("/config").json()
    current["thresholds"]["density_safe"] = 2.5
    current.pop("version")

    res = client.put("/config", json=current)
    assert res.status_code == 200
    body = res.json()
    assert body["thresholds"]["density_safe"] == 2.5
    assert body["version"] == 2

    # Reset back so other tests in this module see a clean default state.
    client.post("/config/reset")


def test_put_config_rejects_bad_ordering_with_422():
    current = client.get("/config").json()
    current["thresholds"]["density_safe"] = 999.0
    current.pop("version")

    res = client.put("/config", json=current)
    assert res.status_code == 422


def test_reset_restores_defaults():
    current = client.get("/config").json()
    current["thresholds"]["density_safe"] = 2.5
    current.pop("version")
    client.put("/config", json=current)

    res = client.post("/config/reset")
    assert res.status_code == 200
    assert res.json()["thresholds"]["density_safe"] == 3.0
