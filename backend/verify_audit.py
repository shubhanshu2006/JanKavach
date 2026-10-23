"""
JanKavach — Statutory Audit Verifier CLI Tool
Run this standalone script to verify the cryptographic SHA-256 integrity
of any CRS incident log file.

Usage:
    python backend/verify_audit.py
    python backend/verify_audit.py CRS_NDLS_20261023_232755.jsonl
"""
import sys
import json
import hashlib
from pathlib import Path

AUDIT_DIR = Path(__file__).parent.parent / "data" / "audit_logs"
GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000"


def verify_file(target_file: Path):
    print("=" * 68)
    print(" COMMISSION OF RAILWAY SAFETY (CRS) — CRYPTOGRAPHIC VERIFIER")
    print(" Statutory Evidence Standard: Section 113, Railways Act 1989")
    print("=" * 68)
    print(f"Target Log File: {target_file.name}")
    print("-" * 68)

    if not target_file.exists():
        print(f"❌ ERROR: File not found: {target_file}")
        return False

    prev_hash = GENESIS_HASH
    seq_expected = 1
    blocks_verified = 0

    with open(target_file, "r", encoding="utf-8") as f:
        for line_no, raw_line in enumerate(f, start=1):
            line = raw_line.strip()
            if not line:
                continue

            try:
                data = json.loads(line)
            except Exception as e:
                print(f"❌ BLOCK #{line_no}: INVALID JSON SYNTAX ({e})")
                return False

            expected_hash = data.get("hash")
            data_copy = dict(data)
            data_copy.pop("hash", None)

            # 1. Verify sequence order
            if data.get("seq") != seq_expected:
                print(f"❌ BLOCK #{line_no}: SEQUENCE GAP! Expected {seq_expected}, got {data.get('seq')}")
                return False

            # 2. Verify previous hash chain linkage
            if data.get("prev_hash") != prev_hash:
                print(f"❌ BLOCK #{line_no}: BROKEN CHAIN LINKAGE!")
                print(f"   Expected prev_hash: {prev_hash}")
                print(f"   Stored prev_hash:   {data.get('prev_hash')}")
                return False

            # 3. Recompute SHA-256 over exact canonical JSON
            serialized = json.dumps(data_copy, sort_keys=True, separators=(",", ":"))
            recomputed = hashlib.sha256(serialized.encode("utf-8")).hexdigest()

            if recomputed != expected_hash:
                print(f"🚨 TAMPER DETECTED AT BLOCK #{line_no} ({data.get('event_type')})!")
                print(f"   Stored Hash:    {expected_hash}")
                print(f"   Calculated Hash:{recomputed}")
                print(f"   The data inside Block #{line_no} was illegally modified!")
                print("=" * 68)
                print("RESULT: ❌ FORGERY / DATA TAMPERING CONFIRMED — CHAIN REJECTED")
                print("=" * 68)
                return False

            ev_type = data.get("event_type", "UNKNOWN")
            actor = data.get("actor", "SYSTEM")
            print(f"  [Block #{line_no:02d}] {ev_type:<28} | {actor:<22} | OK (hash: {expected_hash[:12]}...)")

            prev_hash = expected_hash
            seq_expected += 1
            blocks_verified += 1

    print("-" * 68)
    print(f"RESULT: ✅ PASSED — ALL {blocks_verified} BLOCKS CRYPTOGRAPHICALLY INTACT")
    print("Cryptographic Proof: SHA-256 hash-chain verified. Zero tampering detected.")
    print(f"Latest Statutory Seal: {prev_hash}")
    print("=" * 68)
    return True


def main():
    if len(sys.argv) > 1:
        target_name = sys.argv[1]
        target_path = Path(target_name) if Path(target_name).is_absolute() else AUDIT_DIR / target_name
    else:
        # Pick the latest non-empty file or largest log file
        log_files = sorted(AUDIT_DIR.glob("*.jsonl"), key=lambda p: p.stat().st_size, reverse=True)
        if not log_files:
            print("No audit log files found in data/audit_logs/")
            return
        target_path = log_files[0]

    verify_file(target_path)


if __name__ == "__main__":
    main()
