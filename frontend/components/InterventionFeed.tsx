"use client";
import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Intervention } from "@/lib/types";
import { LEVEL_COLORS } from "@/lib/constants";
import { useStationConfig } from "@/lib/config-context";

const LEVEL_TAG: Record<number, string> = {
  1: "L1 AUTO",
  2: "L2 STAGED",
  3: "L3 CONFIRM",
  4: "PRE-WARN",
  5: "SOS",
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  fired:     { label: "AUTO-EXEC", color: "var(--sweep)" },
  confirmed: { label: "ACCEPTED",  color: "var(--text-mute)" },
  cancelled: { label: "CANCELLED", color: "var(--text-faint)" },
};

// Staged/pending_confirm interventions are handled by the unified
// ThresholdConfirmCard pop-ups, not this log — the log only ever shows
// what was actually done (auto-executed, accepted, or cancelled), so a
// dozen zones tripping the same threshold at once doesn't flood it with
// one pending row apiece.
const LOGGED_STATUSES = new Set(["fired", "confirmed", "cancelled"]);

interface Props {
  interventions: Intervention[];
}

export default function InterventionFeed({ interventions }: Props) {
  const { config } = useStationConfig();
  const shortLabel = (zoneId: string) =>
    config?.zones.find((z) => z.id === zoneId)?.short_label ?? zoneId;
  const logged = interventions.filter((iv) => LOGGED_STATUSES.has(iv.status));
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logged.length]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="panel-title" style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
        <span>CONTACT LOG</span>
        <span style={{ marginLeft: "auto", color: "var(--text-faint)" }}>{logged.length} EVT</span>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin" style={{ minHeight: 0 }}>
        <AnimatePresence initial={false}>
          {logged.map(iv => <LogRow key={iv.id} iv={iv} shortLabel={shortLabel} />)}
        </AnimatePresence>
        <div ref={bottomRef} />
        {logged.length === 0 && (
          <div className="scope" style={{
            padding: "32px 16px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            color: "var(--text-faint)",
            textAlign: "center"
          }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "4px 10px",
              background: "rgba(41,255,140,0.06)",
              border: "1px solid rgba(41,255,140,0.2)",
              borderRadius: 4,
            }}>
              <motion.span
                style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--sweep)", display: "inline-block" }}
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.4, repeat: Infinity }}
              />
              <span style={{ fontSize: 9.5, color: "var(--sweep)", fontWeight: 700, letterSpacing: "0.12em" }}>
                SENSORS ARMED · TELEMETRY STANDBY
              </span>
            </div>
            <div style={{ fontSize: 9, color: "var(--text-faint)", letterSpacing: "0.08em", maxWidth: 220, lineHeight: 1.5 }}>
              CONTINUOUS SPATIAL RADAR MONITORING (12 ACTIVE ZONES)
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LogRow({ iv, shortLabel }: { iv: Intervention; shortLabel: (zoneId: string) => string }) {
  const levelColor = LEVEL_COLORS[iv.level];
  const sMeta      = STATUS_META[iv.status] ?? { label: iv.status.toUpperCase(), color: "var(--text-mute)" };
  const zone       = shortLabel(iv.zone);
  const isDimmed   = iv.status === "confirmed" || iv.status === "cancelled";

  return (
    <motion.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: isDimmed ? 0.45 : 1, x: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="scope"
      style={{
        borderBottom: "1px solid var(--hair-dim)",
        borderLeft: `3px solid ${isDimmed ? "var(--hair)" : levelColor}`,
        padding: "7px 12px",
        background: isDimmed ? "transparent" : "rgba(255,255,255,0.012)",
        transition: "background 0.15s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
        <span style={{
          width: 5, height: 5, borderRadius: "50%",
          background: isDimmed ? "var(--text-faint)" : levelColor,
          boxShadow: isDimmed ? "none" : `0 0 6px ${levelColor}`,
          flexShrink: 0
        }} />
        <span style={{
          fontSize: 9.5, fontWeight: 700,
          color: isDimmed ? "var(--text-faint)" : levelColor,
          letterSpacing: "0.08em"
        }}>
          {LEVEL_TAG[iv.level]}
        </span>
        <span style={{
          fontSize: 8.5,
          color: sMeta.color,
          letterSpacing: "0.06em",
          padding: "1px 4px",
          background: "rgba(0,0,0,0.3)",
          borderRadius: 2,
        }}>
          {sMeta.label}
        </span>
        <span style={{ fontSize: 9, color: "var(--text-faint)", marginLeft: "auto", fontFamily: "'Share Tech Mono', monospace" }}>
          {iv.timestamp}
        </span>
      </div>
      <div style={{ fontSize: 10.5, color: isDimmed ? "var(--text-faint)" : "var(--text)", letterSpacing: "0.02em", paddingLeft: 12 }}>
        <span style={{ color: isDimmed ? "var(--text-faint)" : "var(--sweep)", fontWeight: 600 }}>{zone} · </span>
        {iv.action.split(":")[0]}
      </div>
      {iv.response_time_ms > 0 && (
        <div style={{ fontSize: 8.5, color: "var(--text-faint)", marginTop: 2, paddingLeft: 12 }}>
          RSP {iv.response_time_ms.toFixed(0)}ms
        </div>
      )}
    </motion.div>
  );
}
