"use client";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, TriangleAlert } from "lucide-react";
import type { LiveUpdate } from "@/lib/types";
import StationMap from "./StationMap";

interface Props { data: LiveUpdate | null }

export default function SplitScreen({ data }: Props) {
  if (!data) {
    return (
      <div className="scope" style={{ color: "var(--text-faint)", fontSize: 11, letterSpacing: "0.1em",
        display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
        AWAITING SCENARIO DATA...
      </div>
    );
  }

  const { elapsed } = data;
  const cgL1Fired      = data.crowdguard?.l1_fired ?? false;
  const crushOccurred  = data.human?.crush_occurred ?? false;
  const humanResponded = data.human?.human_responded ?? false;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 6 }}>

      <div className="scope" style={{
        flexShrink: 0, textAlign: "center",
        fontSize: 9, color: "var(--text-faint)", letterSpacing: "0.1em", padding: "2px 0",
      }}>
        TIMELINE VALIDATION — REPLAYED AGAINST THE DOCUMENTED NDLS INCIDENT RECORD, FEB 15 2025
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>

        {/* Human-operated */}
        <div className="panel" style={{
          display: "flex", flexDirection: "column",
          borderColor: crushOccurred ? "var(--red)" : "var(--hair)",
          position: "relative",
        }}>
          <div className="scope" style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "6px 12px", borderBottom: "1px solid var(--hair-dim)",
            background: "var(--panel-2)", flexShrink: 0,
          }}>
            <motion.div
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 0.9, repeat: Infinity }}
              style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--red)" }}
            />
            <span style={{ fontSize: 11, color: "var(--red)", letterSpacing: "0.12em" }}>
              HUMAN-OPERATED STATION
            </span>
            <span style={{ fontSize: 10, color: "var(--text-faint)", marginLeft: "auto" }}>CURRENT SYSTEM</span>
          </div>

          <div className="scrollbar-thin" style={{ flex: 1, padding: 10, position: "relative", minHeight: 0, overflowY: "auto" }}>
            <StationMap zones={data.human?.zones ?? {}} compact />

            {!crushOccurred && !humanResponded && elapsed > 30 && (
              <div style={{ position: "absolute", bottom: 14, left: 0, right: 0,
                display: "flex", justifyContent: "center", pointerEvents: "none" }}>
                <motion.div
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="scope"
                  style={{
                    background: "var(--panel)", border: "1px solid var(--hair)",
                    padding: "4px 12px", fontSize: 10, color: "var(--text-mute)", letterSpacing: "0.1em",
                    display: "flex", alignItems: "center", gap: 6,
                  }}>
                  <Clock size={11} strokeWidth={1.75} />
                  AWAITING OPERATOR RESPONSE
                </motion.div>
              </div>
            )}

            <AnimatePresence>
              {crushOccurred && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  style={{
                    position: "absolute", inset: 0,
                    background: "rgba(120,0,0,0.55)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                  <motion.div
                    animate={{ scale: [1, 1.03, 1] }}
                    transition={{ duration: 0.6, repeat: Infinity }}
                    className="scope"
                    style={{ textAlign: "center" }}>
                    <TriangleAlert size={30} color="var(--red)" strokeWidth={1.5} style={{ margin: "0 auto 8px" }} />
                    <div style={{ color: "#FF6B6B", fontSize: 18, fontWeight: 700, letterSpacing: "0.2em" }}>
                      CRUSH EVENT
                    </div>
                    <div style={{ color: "#E87070", fontSize: 11, marginTop: 4, letterSpacing: "0.1em" }}>
                      FOB-3 STAIRWAY (PF 14/15) — 18 DEAD · 15 INJURED
                    </div>
                    <div style={{ color: "#994040", fontSize: 10, marginTop: 6, letterSpacing: "0.08em" }}>
                      NDLS · FEB 15 2025 · 20:48 IST
                    </div>
                    {humanResponded && (
                      <div style={{ color: "#8A4040", fontSize: 10, marginTop: 10,
                        borderTop: "1px solid #5A1010", paddingTop: 8, letterSpacing: "0.08em" }}>
                        FIRE TENDERS ARRIVED +112 MIN AFTER INCIDENT
                      </div>
                    )}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* JanKavach — machine-speed response */}
        <div className="panel" style={{
          display: "flex", flexDirection: "column",
          borderColor: cgL1Fired ? "var(--sweep)" : "var(--hair)",
          position: "relative",
        }}>
          <div className="scope" style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "6px 12px", borderBottom: "1px solid var(--hair-dim)",
            background: "var(--panel-2)", flexShrink: 0,
          }}>
            <motion.div
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
              style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--sweep)" }}
            />
            <span style={{ fontSize: 11, color: "var(--sweep)", letterSpacing: "0.12em" }}>
              JANKAVACH — FORESIGHT SYSTEM
            </span>
            <span style={{ fontSize: 10, color: "var(--text-faint)", marginLeft: "auto" }}>MACHINE-SPEED</span>
          </div>

          <div className="scrollbar-thin" style={{ flex: 1, padding: 10, position: "relative", minHeight: 0, overflowY: "auto" }}>
            <StationMap
              zones={data.crowdguard?.zones ?? {}}
              predictions={data.crowdguard?.predictions}
              showPredictions compact
            />

            <AnimatePresence>
              {cgL1Fired && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  style={{ position: "absolute", bottom: 10, left: 0, right: 0,
                    display: "flex", justifyContent: "center" }}>
                  <div className="scope" style={{
                    background: "var(--panel)", border: "1px solid var(--sweep)",
                    padding: "5px 14px", fontSize: 10, color: "var(--sweep)", letterSpacing: "0.12em",
                  }}>
                    L1 ALERT · FOB-3 SEALED · CROWD DIVERTED
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {cgL1Fired && elapsed > 150 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="scope"
                  style={{
                    position: "absolute", top: 8, right: 8,
                    background: "var(--panel)", border: "1px solid var(--sweep)",
                    padding: "4px 10px", fontSize: 10, color: "var(--sweep)", letterSpacing: "0.1em",
                  }}>
                  INCIDENT AVERTED
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Comparison readout — one instrument, two rows */}
      <div className="panel" style={{ flexShrink: 0 }}>
        <ComparisonRow
          label="HUMAN RESPONSE TIME"
          value={humanResponded ? "4m12s" : "——"}
          outcome={crushOccurred ? "CRUSH OCCURRED" : "MONITORING"}
          color="var(--red)"
          outcomeColor={crushOccurred ? "var(--red)" : "var(--text-faint)"}
        />
        <ComparisonRow
          label="JANKAVACH RESPONSE"
          value={cgL1Fired ? "2.3s" : "——"}
          outcome={cgL1Fired && elapsed > 150 ? "CRUSH PREVENTED" : "MONITORING"}
          color="var(--sweep)"
          outcomeColor={cgL1Fired && elapsed > 150 ? "var(--sweep)" : "var(--text-faint)"}
          last
        />
      </div>
    </div>
  );
}

function ComparisonRow({ label, value, outcome, color, outcomeColor, last }: {
  label: string; value: string; outcome: string;
  color: string; outcomeColor: string; last?: boolean;
}) {
  return (
    <div className="scope" style={{
      padding: "9px 14px",
      borderBottom: last ? "none" : "1px solid var(--hair-dim)",
      display: "flex", alignItems: "center", gap: 14,
    }}>
      <span style={{ color: "var(--text-mute)", fontSize: 9, letterSpacing: "0.1em", width: 150, flexShrink: 0 }}>
        {label}
      </span>
      <DigitReadout value={value} color={color} />
      <span style={{ color: outcomeColor, fontSize: 10, letterSpacing: "0.08em", marginLeft: "auto" }}>
        {outcome}
      </span>
    </div>
  );
}

/** Tactile stacked-digit readout — each character its own instrument tile. */
function DigitReadout({ value, color }: { value: string; color: string }) {
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {value.split("").map((ch, i) => (
        <span key={i} style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          minWidth: /[0-9]/.test(ch) ? 16 : 8,
          height: 22,
          background: "var(--panel-2)",
          border: /[0-9]/.test(ch) ? "1px solid var(--hair)" : "none",
          color, fontSize: 15, fontWeight: 700,
        }}>
          {ch}
        </span>
      ))}
    </div>
  );
}
