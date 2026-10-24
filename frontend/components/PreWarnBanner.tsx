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
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 32, opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="scope flex-shrink-0"
          style={{
            background: "linear-gradient(90deg, rgba(38, 18, 10, 0.98) 0%, rgba(20, 10, 6, 0.98) 100%)",
            borderBottom: "1px solid var(--prewarn)",
            padding: "0 16px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            overflow: "hidden",
            boxShadow: "0 2px 12px rgba(255, 122, 26, 0.25)",
            zIndex: 40,
          }}
        >
          <motion.div
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 0.7, repeat: Infinity }}
            style={{ display: "flex", alignItems: "center" }}
          >
            <TriangleAlert size={14} color="var(--prewarn)" strokeWidth={2} />
          </motion.div>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--prewarn)", letterSpacing: "0.12em" }}>
            PRE-WARN ACTIVE
          </span>
          <span style={{ fontSize: 10.5, color: "#FFAE73", letterSpacing: "0.06em", fontWeight: 500 }}>
            {intervention
              ? `Zone: ${intervention.zone} — Emergency services on standby`
              : "Emergency services on standby"}
          </span>
          <span style={{
            marginLeft: "auto",
            fontSize: 9,
            fontWeight: 700,
            color: "var(--prewarn)",
            background: "rgba(255,122,26,0.15)",
            border: "1px solid rgba(255,122,26,0.3)",
            padding: "1px 6px",
            borderRadius: 3,
            letterSpacing: "0.08em"
          }}>
            SIMULATED
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
