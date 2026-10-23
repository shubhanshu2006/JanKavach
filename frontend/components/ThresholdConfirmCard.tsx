"use client";
import { motion, AnimatePresence } from "framer-motion";
import { TriangleAlert } from "lucide-react";
import type { Intervention } from "@/lib/types";

interface Props {
  level: 2 | 3;
  items: Intervention[];
  shortLabel: (zoneId: string) => string;
  onConfirmAll: (ids: string[]) => void;
  onCancelAll: (ids: string[]) => void;
}

const LEVEL_META: Record<2 | 3, { color: string; title: string }> = {
  2: { color: "var(--amber)", title: "L2 — CONGESTION MEASURES" },
  3: { color: "var(--red)", title: "L3 — PLATFORM CLOSURE" },
};

/** One threshold level, one card — every zone that simultaneously crossed it
 * is listed together with a single confirm/cancel pair, instead of a separate
 * card per zone flooding the log when several zones trip at once. */
export default function ThresholdConfirmCard({ level, items, shortLabel, onConfirmAll, onCancelAll }: Props) {
  const { color, title } = LEVEL_META[level];
  const ids = items.map((iv) => iv.id);

  return (
    <AnimatePresence>
      {items.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="panel scope"
          style={{
            borderColor: color,
            width: "100%",
            boxShadow: `0 0 16px ${color}20`,
            borderRadius: 4,
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "8px 12px",
            background: `${color}10`,
            borderBottom: `1px solid ${color}30`
          }}>
            <motion.div animate={{ opacity: [1, 0.35, 1] }} transition={{ duration: 0.9, repeat: Infinity }}>
              <TriangleAlert size={14} color={color} strokeWidth={2} />
            </motion.div>
            <span style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: "0.08em" }}>{title}</span>
            <span style={{
              marginLeft: "auto", fontSize: 9, fontWeight: 700,
              padding: "2px 6px", borderRadius: 3,
              background: `${color}25`, color,
              border: `1px solid ${color}40`,
            }}>
              {items.length} ZONE{items.length > 1 ? "S" : ""}
            </span>
          </div>

          <div className="scrollbar-thin" style={{ maxHeight: 130, overflowY: "auto" }}>
            {items.map((iv) => (
              <div key={iv.id} style={{
                padding: "6px 12px", borderBottom: "1px solid var(--hair-dim)",
                fontSize: 10, color: "var(--text)", lineHeight: 1.4,
                display: "flex", alignItems: "baseline", gap: 6,
              }}>
                <span style={{
                  color, fontWeight: 700,
                  fontSize: 10, letterSpacing: "0.04em",
                  flexShrink: 0,
                }}>
                  {shortLabel(iv.zone)}
                </span>
                <span style={{ color: "var(--text-dim)", fontSize: 9.5 }}>
                  {iv.trigger}
                </span>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, padding: "8px 10px", background: "var(--panel-2)" }}>
            <button
              onClick={() => onCancelAll(ids)}
              className="btn-seg"
              style={{
                flex: 1, padding: "7px 0", fontSize: 10, cursor: "pointer",
                background: "transparent", color: "var(--text-mute)",
                border: "1px solid var(--hair)", borderRadius: 3,
                letterSpacing: "0.08em", fontWeight: 600,
              }}
            >
              CANCEL ALL
            </button>
            <button
              onClick={() => onConfirmAll(ids)}
              className="btn-seg"
              style={{
                flex: 1, padding: "7px 0", fontSize: 10, cursor: "pointer",
                background: `${color}25`, color,
                border: `1px solid ${color}`, borderRadius: 3,
                letterSpacing: "0.08em", fontWeight: 700,
                boxShadow: `0 0 10px ${color}30`,
              }}
            >
              CONFIRM ALL
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
