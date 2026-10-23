"use client";
import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TriangleAlert, Check } from "lucide-react";
import type { Intervention } from "@/lib/types";

const SERVICES = [
  { label: "RPF",            detail: "Railway Protection Force deployed" },
  { label: "POLICE 100",     detail: "Delhi Police Emergency Control notified" },
  { label: "FIRE 101",       detail: "Delhi Fire Service dispatched" },
  { label: "AMBULANCE 108",  detail: "National Emergency Ambulance dispatched" },
];

interface Props {
  active: boolean;
  sosIntervention?: Intervention;
  onDismiss?: () => void;
}

export default function EmergencyOverlay({ active, sosIntervention, onDismiss }: Props) {
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => onDismiss?.(), 10000);
    return () => clearTimeout(t);
  }, [active, onDismiss]);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          style={{
            position: "fixed", inset: 0, zIndex: 100,
            background: "rgba(6,4,4,0.92)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <motion.div
            style={{ position: "absolute", inset: 0, border: "3px solid var(--critical)", pointerEvents: "none" }}
            animate={{ opacity: [1, 0.2, 1] }}
            transition={{ duration: 0.6, repeat: Infinity }}
          />

          <div className="scope" style={{
            width: 520, maxWidth: "calc(100vw - 40px)",
            background: "#0A0404",
            border: "1px solid var(--critical)",
            padding: "28px 32px",
          }}>
            <motion.div
              animate={{ opacity: [1, 0.55, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
              style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}
            >
              <TriangleAlert size={22} color="var(--critical)" strokeWidth={1.75} />
              <div style={{ fontSize: 21, fontWeight: 700, color: "#FF6B6B", letterSpacing: "0.08em", lineHeight: 1.25 }}>
                FAILSAFE ACTIVATED — EMERGENCY DISPATCH
              </div>
            </motion.div>

            {sosIntervention && (
              <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 20, lineHeight: 1.6 }}>
                <span style={{ color: "var(--prewarn)" }}>ZONE:</span> {sosIntervention.zone}
                {"  "}
                <span style={{ color: "var(--prewarn)" }}>TRIGGER:</span> {sosIntervention.trigger}
              </div>
            )}

            <div style={{ height: 1, background: "#2A0808", marginBottom: 20 }} />

            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
              {SERVICES.map((svc, i) => (
                <motion.div
                  key={svc.label}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.12, duration: 0.2 }}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "8px 12px",
                    background: "rgba(255,26,26,0.06)",
                    border: "1px solid #2A0808",
                  }}
                >
                  <motion.div
                    animate={{ opacity: [1, 0.4, 1] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.3 }}
                    style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--critical)", flexShrink: 0 }}
                  />
                  <span style={{ fontSize: 12, color: "#FF6B6B", letterSpacing: "0.12em", width: 130 }}>
                    {svc.label}
                  </span>
                  <span style={{ fontSize: 10, color: "#6A3030", letterSpacing: "0.04em" }}>
                    {svc.detail}
                  </span>
                  <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "var(--sweep)", letterSpacing: "0.08em" }}>
                    <Check size={11} strokeWidth={2} /> SENT
                  </span>
                </motion.div>
              ))}
            </div>

            <button
              onClick={onDismiss}
              style={{
                width: "100%", padding: "9px 0", fontSize: 11, cursor: "pointer",
                background: "transparent", color: "#7A4040",
                border: "1px solid #2A0808", letterSpacing: "0.1em",
              }}
            >
              ACKNOWLEDGE — DISMISS OVERLAY
            </button>

            <div style={{ marginTop: 12, fontSize: 9, color: "#4A2020", letterSpacing: "0.08em", textAlign: "center" }}>
              [SIMULATED] — DEMO ENVIRONMENT — NOT CONNECTED TO LIVE SERVICES
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
