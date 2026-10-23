"""
JanKavach — Flight Recorder (Black-Box Audit Engine)

Provides an immutable, cryptographically chained event log for
Commission of Railway Safety (CRS) inquiries and statutory disaster audits.
Every autonomous trigger, operator confirmation, and density threshold crossing
is hashed with SHA-256 and chained to previous events (WORM append-only model).
"""
import hashlib
import json
import time
import datetime
from pathlib import Path
from threading import Lock

# Persistent audit directory under data/audit_logs
_LOG_DIR = Path(__file__).parent.parent.parent / "data" / "audit_logs"
_GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000"


class FlightRecorder:
    def __init__(self, log_dir: Path | None = None):
        self._dir = log_dir or _LOG_DIR
        self._dir.mkdir(parents=True, exist_ok=True)
        self._lock = Lock()
        self.session_id: str = ""
        self.current_file: Path | None = None
        self.prev_hash: str = _GENESIS_HASH
        self.sequence: int = 0
        self.events_in_memory: list[dict] = []
        self._start_new_session("scenario", max_level=5)

    def _start_new_session(self, mode: str = "scenario", max_level: int = 5):
        """Initializes a new incident logging session."""
        with self._lock:
            now_dt = datetime.datetime.now()
            self.session_id = f"CRS_NDLS_{now_dt.strftime('%Y%m%d_%H%M%S')}"
            self.current_file = self._dir / f"{self.session_id}.jsonl"
            self.prev_hash = _GENESIS_HASH
            self.sequence = 0
            self.events_in_memory = []

            # Write Genesis Block
            genesis_payload = {
                "station_code": "NDLS",
                "station_name": "New Delhi Railway Station",
                "division": "Delhi Division",
                "zone": "Northern Railway",
                "mode": mode,
                "max_level": max_level,
                "system": "JanKavach Autonomous Decision Engine v1.3",
                "standards_compliance": ["NDMA-CrowdSafety-2014", "RDSO-IR-PIDS", "CRS-Statutory-Audit"],
            }
            self._write_event("SESSION_GENESIS", "ALL_ZONES", genesis_payload, actor="SYSTEM")

    def reset_session(self, mode: str = "scenario", max_level: int = 5):
        self._start_new_session(mode=mode, max_level=max_level)

    def record_event(self, event_type: str, zone: str, payload: dict, actor: str = "SYSTEM") -> dict:
        """Records an event, computes SHA-256 hash, and appends to WORM storage."""
        with self._lock:
            return self._write_event(event_type, zone, payload, actor=actor)

    def _write_event(self, event_type: str, zone: str, payload: dict, actor: str = "SYSTEM") -> dict:
        self.sequence += 1
        now_ts = time.time()
        now_ist = datetime.datetime.fromtimestamp(now_ts).strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]

        event_body = {
            "seq": self.sequence,
            "session_id": self.session_id,
            "timestamp": round(now_ts, 4),
            "timestamp_ist": now_ist,
            "event_type": event_type,
            "zone": zone,
            "actor": actor,
            "payload": payload,
            "prev_hash": self.prev_hash,
        }

        # Capture forensic camera snapshot for operational events
        if event_type != "SESSION_GENESIS" and "evidence_snapshot" not in payload:
            try:
                from audit.snapshot_engine import snapshot_engine
                snap_meta = snapshot_engine.capture_snapshot(
                    session_id=self.session_id,
                    seq=self.sequence,
                    event_type=event_type,
                    zone_id=zone,
                    density=float(payload.get("density", 5.0)),
                    action=str(payload.get("action", "")),
                )
                if snap_meta:
                    payload["evidence_snapshot"] = snap_meta
            except Exception:
                pass

        # Deterministic JSON serialization for SHA-256
        serialized = json.dumps(event_body, sort_keys=True, separators=(",", ":"))
        event_hash = hashlib.sha256(serialized.encode("utf-8")).hexdigest()
        event_body["hash"] = event_hash
        self.prev_hash = event_hash

        self.events_in_memory.append(event_body)

        # Write to append-only JSONL
        if self.current_file:
            with open(self.current_file, "a", encoding="utf-8") as f:
                f.write(json.dumps(event_body) + "\n")

        return event_body

    def verify_chain(self, file_path: Path | None = None) -> tuple[bool, str, int]:
        """
        Validates the cryptographic hash chain of an audit file.
        Returns: (is_valid, status_message, verified_blocks_count)
        """
        target = file_path or self.current_file
        if not target or not target.exists():
            return False, "Audit log file does not exist", 0

        prev_hash = _GENESIS_HASH
        seq_expected = 1
        count = 0

        with open(target, "r", encoding="utf-8") as f:
            for line_no, line in enumerate(f, start=1):
                line = line.strip()
                if not line:
                    continue
                try:
                    data = json.loads(line)
                except Exception as e:
                    return False, f"Line {line_no} contains invalid JSON: {e}", count

                expected_hash = data.get("hash")
                data_copy = dict(data)
                data_copy.pop("hash", None)

                # Verify previous hash link
                if data.get("prev_hash") != prev_hash:
                    return False, f"Block {line_no} broken hash link: prev_hash mismatch", count

                # Verify sequence
                if data.get("seq") != seq_expected:
                    return False, f"Block {line_no} sequence gap: expected {seq_expected}, got {data.get('seq')}", count

                # Recompute hash
                serialized = json.dumps(data_copy, sort_keys=True, separators=(",", ":"))
                recomputed = hashlib.sha256(serialized.encode("utf-8")).hexdigest()

                if recomputed != expected_hash:
                    return False, f"Block {line_no} data modified! Tampered hash detected", count

                prev_hash = expected_hash
                seq_expected += 1
                count += 1

        return True, f"All {count} blocks cryptographically verified and intact", count

    def get_summary(self) -> dict:
        """Returns brief summary for UI status bars."""
        with self._lock:
            human_latencies = [
                e["payload"].get("latency_ms", 0.0)
                for e in self.events_in_memory
                if e["event_type"] in ("OPERATOR_CONFIRMED", "OPERATOR_CANCELLED")
                and "latency_ms" in e.get("payload", {})
            ]
            avg_latency = (
                round(sum(human_latencies) / len(human_latencies) / 1000.0, 2)
                if human_latencies
                else None
            )

            is_valid, msg, count = self.verify_chain()

            return {
                "session_id": self.session_id,
                "total_events": len(self.events_in_memory),
                "is_sealed": is_valid,
                "chain_status": msg,
                "last_hash": self.prev_hash,
                "operator_actions_count": len(human_latencies),
                "average_human_latency_seconds": avg_latency,
            }

    def get_dossier(self, session_id: str | None = None) -> dict:
        """Packages the full statutory inquiry dossier for current or specified session."""
        with self._lock:
            target_file = None
            if session_id:
                candidate = self._dir / f"{session_id}.jsonl"
                if candidate.exists():
                    target_file = candidate
            elif len(self.events_in_memory) <= 1:
                # If current in-memory session is empty (e.g. right after a reset),
                # pick the most recent completed log file with real events
                all_logs = sorted(self._dir.glob("*.jsonl"), key=lambda p: p.stat().st_size, reverse=True)
                if all_logs and all_logs[0].stat().st_size > 1000:
                    target_file = all_logs[0]

            if target_file and target_file != self.current_file:
                events = []
                with open(target_file, "r", encoding="utf-8") as f:
                    for line in f:
                        if line.strip():
                            try:
                                events.append(json.loads(line.strip()))
                            except Exception:
                                pass
                is_valid, msg, count = self.verify_chain(file_path=target_file)
                active_session_id = target_file.stem
                latest_hash = events[-1].get("hash") if events else self.prev_hash
            else:
                events = self.events_in_memory
                is_valid, msg, count = self.verify_chain()
                active_session_id = self.session_id
                latest_hash = self.prev_hash

            # Extract key milestones
            l1_events = [e for e in events if "L1" in e["payload"].get("level", "")]
            l2_events = [e for e in events if "L2" in e["payload"].get("level", "")]
            human_actions = [e for e in events if e["event_type"] in ("OPERATOR_CONFIRMED", "OPERATOR_CANCELLED")]
            sos_events = [e for e in events if "SOS" in e["payload"].get("level", "")]

            return {
                "dossier_title": "COMMISSION OF RAILWAY SAFETY — STATUTORY INCIDENT DOSSIER",
                "authority": "Ministry of Railways / Commission of Railway Safety (CRS)",
                "incident_location": "New Delhi Railway Station (NDLS) — Foot-Over-Bridge 3 / Platforms 14-16",
                "session_id": active_session_id,
                "generated_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S IST"),
                "cryptographic_verification": {
                    "algorithm": "SHA-256 Hash Chained WORM Ledger",
                    "chain_intact": is_valid,
                    "verified_blocks": count,
                    "root_genesis": _GENESIS_HASH,
                    "latest_seal": latest_hash,
                },
                "executive_metrics": {
                    "total_recorded_events": len(events),
                    "autonomous_triggers_count": len(l1_events) + len(sos_events),
                    "human_staged_decisions_count": len(l2_events),
                    "human_actions_taken": len(human_actions),
                    "human_reaction_latencies": [
                        {
                            "zone": e["zone"],
                            "action": e["payload"].get("action", ""),
                            "decision": e["event_type"],
                            "latency_seconds": round(e["payload"].get("latency_ms", 0.0) / 1000.0, 2),
                        }
                        for e in human_actions
                    ],
                },
                "chronological_event_stream": events,
            }

    def list_sessions(self) -> list[dict]:
        """Scans data/audit_logs and returns metadata for all historical sessions."""
        sessions = []
        files = sorted(self._dir.glob("*.jsonl"), key=lambda p: p.stat().st_mtime, reverse=True)
        for f in files:
            try:
                with open(f, "r", encoding="utf-8") as fp:
                    lines = [line.strip() for line in fp if line.strip()]
                if not lines:
                    continue
                first_event = json.loads(lines[0])
                last_event = json.loads(lines[-1])

                has_sos = any('"level": "SOS"' in line or '"level":"SOS"' in line for line in lines)
                has_confirm = any("OPERATOR_CONFIRMED" in line for line in lines)
                has_l2 = any('"level": "L2"' in line or '"level":"L2"' in line for line in lines)

                if has_sos:
                    classification = "CRITICAL_SOS"
                    badge_label = "🔴 L5 SOS DISPATCH"
                elif has_l2 or has_confirm:
                    classification = "INTERVENTION_ACTIVE"
                    badge_label = "🟠 L2/L3 CONFIRMED"
                elif len(lines) > 1:
                    classification = "L1_MONITORING"
                    badge_label = "🟡 L1 PA ALERTS"
                else:
                    classification = "IDLE_BASELINE"
                    badge_label = "⚪ IDLE BASELINE"

                sessions.append({
                    "session_id": f.stem,
                    "filename": f.name,
                    "event_count": len(lines),
                    "created_at_ist": first_event.get("timestamp_ist", ""),
                    "last_updated_ist": last_event.get("timestamp_ist", ""),
                    "classification": classification,
                    "badge_label": badge_label,
                    "file_size_kb": round(f.stat().st_size / 1024, 1),
                })
            except Exception:
                pass
        return sessions


# Singleton instance
audit_recorder = FlightRecorder()
