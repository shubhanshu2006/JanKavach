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
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 40 }}
          transition={{ type: "spring", damping: 26, stiffness: 240 }}
          className="panel scope"
          style={{ borderColor: color, width: 320 }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 12px", borderBottom: "1px solid var(--hair-dim)" }}>
            <motion.div animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1, repeat: Infinity }}>
              <TriangleAlert size={13} color={color} strokeWidth={1.75} />
            </motion.div>
            <span style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: "0.1em" }}>{title}</span>
            <span style={{ marginLeft: "auto", fontSize: 9, color: "var(--text-faint)" }}>
              {items.length} ZONE{items.length > 1 ? "S" : ""}
            </span>
          </div>

          <div className="scrollbar-thin" style={{ maxHeight: 160, overflowY: "auto" }}>
            {items.map((iv) => (
              <div key={iv.id} style={{
                padding: "6px 12px", borderBottom: "1px solid var(--hair-dim)",
                fontSize: 10, color: "var(--text-dim)", lineHeight: 1.4,
              }}>
                <span style={{ color: "var(--text-mute)", fontWeight: 700 }}>{shortLabel(iv.zone)}</span>
                {" — "}{iv.trigger}
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 6, padding: 10 }}>
            <button onClick={() => onCancelAll(ids)} style={{
              flex: 1, padding: "7px 0", fontSize: 10, cursor: "pointer",
              background: "transparent", color: "var(--text-mute)",
              border: "1px solid var(--hair)", letterSpacing: "0.08em",
            }}>
              CANCEL ALL
            </button>
            <button onClick={() => onConfirmAll(ids)} style={{
              flex: 1, padding: "7px 0", fontSize: 10, cursor: "pointer",
              background: `${color}18`, color,
              border: `1px solid ${color}`, letterSpacing: "0.08em",
            }}>
              CONFIRM ALL
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
