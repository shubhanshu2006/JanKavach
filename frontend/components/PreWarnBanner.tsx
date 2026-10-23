"use client";
import { motion, AnimatePresence } from "framer-motion";
import { TriangleAlert } from "lucide-react";
import type { Intervention } from "@/lib/types";

interface Props {
  active: boolean;
  intervention?: Intervention;
}

export default function PreWarnBanner({ active, intervention }: Props) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
          className="scope"
          style={{
            position: "fixed", top: 44, left: 0, right: 0, zIndex: 90,
            background: "rgba(255,122,26,0.10)",
            borderBottom: "1px solid var(--prewarn)",
            padding: "8px 16px",
            display: "flex", alignItems: "center", gap: 10,
          }}
        >
          <motion.div
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 0.7, repeat: Infinity }}
          >
            <TriangleAlert size={13} color="var(--prewarn)" strokeWidth={1.75} />
          </motion.div>
          <span style={{ fontSize: 11, color: "var(--prewarn)", letterSpacing: "0.12em" }}>
            PRE-WARN ACTIVE
          </span>
          <span style={{ fontSize: 10, color: "#B0784A", letterSpacing: "0.06em" }}>
            {intervention
              ? `Zone: ${intervention.zone} — Emergency services on standby`
              : "Emergency services on standby"}
          </span>
          <span style={{ marginLeft: "auto", fontSize: 9, color: "#7A5030", letterSpacing: "0.08em" }}>
            [SIMULATED]
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
