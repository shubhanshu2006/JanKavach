import json
import time
from pathlib import Path
import pytest
from audit.flight_recorder import FlightRecorder
from decision.engine import DecisionEngine


def test_audit_genesis_and_chain_validity(tmp_path: Path):
    recorder = FlightRecorder(log_dir=tmp_path)
    # Session starts with Genesis block
    assert recorder.sequence == 1
    assert recorder.events_in_memory[0]["event_type"] == "SESSION_GENESIS"

    # Add several events
    recorder.record_event("AUTONOMOUS_INTERVENTION", "FOB1", {"level": "L1", "density": 5.2})
    recorder.record_event("INTERVENTION_STAGED", "FOB1", {"level": "L2", "density": 6.1})
    recorder.record_event("OPERATOR_CONFIRMED", "FOB1", {"latency_ms": 3210.5, "operator_id": "TEST_OFFICER"})

    assert recorder.sequence == 4
    is_valid, msg, count = recorder.verify_chain()
    assert is_valid is True
    assert count == 4
    assert "cryptographically verified" in msg


def test_audit_tamper_detection(tmp_path: Path):
    recorder = FlightRecorder(log_dir=tmp_path)
    recorder.record_event("AUTONOMOUS_INTERVENTION", "FOB1", {"level": "L1", "density": 5.2})
    recorder.record_event("OPERATOR_CONFIRMED", "FOB1", {"latency_ms": 4500.0, "operator_id": "OFFICER_A"})

    # Verify initially intact
    is_valid, _, _ = recorder.verify_chain()
    assert is_valid is True

    # Corrupt line 2 (tamper with the data)
    log_file = recorder.current_file
    with open(log_file, "r", encoding="utf-8") as f:
        lines = f.readlines()

    tampered_event = json.loads(lines[1])
    # Alter density from 5.2 to 2.1 (tamper with recorded hazard)
    tampered_event["payload"]["density"] = 2.1
    lines[1] = json.dumps(tampered_event) + "\n"

    with open(log_file, "w", encoding="utf-8") as f:
        f.writelines(lines)

    # Verification must detect tampering
    is_valid, msg, count = recorder.verify_chain()
    assert is_valid is False
    assert "Tampered hash detected" in msg


def test_decision_engine_records_latency_on_confirm(tmp_path: Path):
    recorder = FlightRecorder(log_dir=tmp_path)
    engine = DecisionEngine(record_audit=True)
    # Temporarily redirect engine's global audit recorder or verify via engine
    from audit import flight_recorder
    orig_recorder = flight_recorder.audit_recorder
    try:
        flight_recorder.audit_recorder = recorder
        # Stage an L2
        engine.evaluate({"FOB1": {"density": 6.5}}, {})
        staged = engine.get_staged()
        assert len(staged) == 1
        iv_id = staged[0].id

        # Simulate operator thinking time of 100ms
        time.sleep(0.1)

        confirmed = engine.confirm(iv_id, operator_id="TEST_SUPERVISOR")
        assert confirmed is True

        # Check recorded event
        events = recorder.events_in_memory
        confirm_events = [e for e in events if e["event_type"] == "OPERATOR_CONFIRMED"]
        assert len(confirm_events) == 1
        payload = confirm_events[0]["payload"]
        assert payload["operator_id"] == "TEST_SUPERVISOR"
        assert payload["latency_ms"] >= 80.0  # At least sleep time
    finally:
        flight_recorder.audit_recorder = orig_recorder


def test_dossier_structure_and_export(tmp_path: Path):
    recorder = FlightRecorder(log_dir=tmp_path)
    recorder.record_event("AUTONOMOUS_INTERVENTION", "FOB1", {"level": "L1", "density": 5.2})
    recorder.record_event("OPERATOR_CONFIRMED", "FOB1", {"latency_ms": 2100.0, "operator_id": "SUPERVISOR"})

    dossier = recorder.get_dossier()
    assert "COMMISSION OF RAILWAY SAFETY" in dossier["dossier_title"]
    assert dossier["cryptographic_verification"]["chain_intact"] is True
    assert dossier["executive_metrics"]["total_recorded_events"] == 3
    assert len(dossier["chronological_event_stream"]) == 3
