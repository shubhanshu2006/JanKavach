"use client";
import { useState, useEffect } from "react";
import { useStationConfig } from "@/lib/config-context";
import { API_URL } from "@/lib/constants";
import type { ThresholdConfig } from "@/lib/types";

type Key = keyof ThresholdConfig;

const FIELDS: { key: Key; label: string }[] = [
  { key: "density_safe", label: "Safe (green) below" },
  { key: "density_warning", label: "Warning (amber) below" },
  { key: "density_critical", label: "Critical (red) below" },
  { key: "l1_trigger", label: "L1 auto-fire at" },
  { key: "l2_trigger", label: "L2 stage at" },
  { key: "pre_warn_trigger", label: "PRE-WARN at" },
  { key: "l3_trigger", label: "L3 stage (predicted t+90s) at" },
  { key: "failsafe_trigger", label: "SOS at" },
  { key: "l2_countdown_seconds", label: "L2 elapsed-urgency window (s)" },
];

// Two independent ascending ladders — density color bands, and the escalation
// trigger levels. Mirrors backend/config/schema.py's check_ordering exactly,
// including the minimum gap: two thresholds sitting closer than this fire in
// the same broadcast tick regardless of demo speed, since the scripted curve
// crosses a narrow density range in almost no real time — indistinguishable
// from the old "everything fires at once" bug.
const MIN_GAP = 0.5;
const CHAINS: Key[][] = [
  ["density_safe", "density_warning", "density_critical"],
  ["l1_trigger", "l2_trigger", "pre_warn_trigger", "l3_trigger", "failsafe_trigger"],
];

function chainErrors(draft: ThresholdConfig): Partial<Record<Key, string>> {
  const errors: Partial<Record<Key, string>> = {};
  for (const keys of CHAINS) {
    for (let i = 0; i < keys.length - 1; i++) {
      const a = keys[i], b = keys[i + 1];
      if (draft[b] - draft[a] < MIN_GAP) {
        errors[a] = `Must be at least ${MIN_GAP} below next threshold.`;
      }
    }
  }
  return errors;
}

interface Props {
  demoActive?: boolean;
  onApplied?: () => void;
}

export default function ThresholdsTab({ demoActive, onApplied }: Props) {
  const { config, refresh } = useStationConfig();
  const [draft, setDraft] = useState<ThresholdConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (config && !draft) setDraft(config.thresholds);
  }, [config, draft]);

  if (!config || !draft) return <p style={{ color: "var(--text-faint)", fontSize: 12 }}>Loading…</p>;

  const fieldErrors = chainErrors(draft);
  const hasErrors = Object.keys(fieldErrors).length > 0;

  function update(key: Key, value: number) {
    setNote(null);
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function apply(thresholds: ThresholdConfig) {
    setSaving(true);
    setError(null);
    const res = await fetch(`${API_URL}/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...config, thresholds }),
    });
    if (!res.ok) {
      setSaving(false);
      const body = await res.json().catch(() => null);
      setError(body?.detail ? JSON.stringify(body.detail) : `Save failed (${res.status})`);
      return;
    }
    setDraft(thresholds);
    await refresh();
    setSaving(false);
    if (demoActive) {
      onApplied?.();
      setNote("Saved — demo restarted so interventions fire against the new thresholds.");
    } else {
      setNote("Saved.");
    }
  }

  async function resetToDefault() {
    setSaving(true);
    setError(null);
    const res = await fetch(`${API_URL}/config/thresholds/defaults`);
    if (!res.ok) {
      setSaving(false);
      setError(`Failed to load defaults (${res.status})`);
      return;
    }
    const defaults: ThresholdConfig = await res.json();
    await apply(defaults);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {FIELDS.map(({ key, label }) => (
        <label key={key} style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 11, color: "var(--text-dim)" }}>
          {label}
          <input
            type="number" step="0.1"
            value={draft[key]}
            onChange={(e) => update(key, Number(e.target.value))}
            style={{
              background: "var(--surface, #161B22)",
              border: `1px solid ${fieldErrors[key] ? "var(--red, #FF3B3B)" : "var(--hair, #21262D)"}`,
              color: "var(--text-primary, #F1F5F9)", padding: "6px 8px", fontSize: 13,
            }}
          />
          {fieldErrors[key] && (
            <span style={{ color: "var(--red, #FF3B3B)", fontSize: 10 }}>{fieldErrors[key]}</span>
          )}
        </label>
      ))}

      {error && <p style={{ color: "var(--red, #FF3B3B)", fontSize: 11 }}>{error}</p>}
      {note && !error && <p style={{ color: "var(--sweep, #29FF8C)", fontSize: 11 }}>{note}</p>}

      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button
          onClick={resetToDefault}
          disabled={saving}
          style={{
            padding: "8px 12px", background: "none", color: "var(--text-dim, #94A3B8)",
            border: "1px solid var(--hair, #21262D)", fontWeight: 700, fontSize: 12,
            cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.5 : 1,
          }}
        >
          RESET TO DEFAULT
        </button>
        <button
          onClick={() => apply(draft)}
          disabled={hasErrors || saving}
          style={{
            flex: 1, padding: "8px 12px", background: "var(--sweep, #29FF8C)", color: "#04070A",
            border: "none", fontWeight: 700, fontSize: 12, cursor: hasErrors ? "not-allowed" : "pointer",
            opacity: hasErrors ? 0.5 : 1,
          }}
        >
          {saving ? "SAVING…" : "SAVE THRESHOLDS"}
        </button>
      </div>
    </div>
  );
}
