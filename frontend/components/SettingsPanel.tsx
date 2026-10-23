"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import ThresholdsTab from "./settings/ThresholdsTab";
import CategoriesTab from "./settings/CategoriesTab";
import ZonesTab from "./settings/ZonesTab";
import ViewsTab from "./settings/ViewsTab";

type Tab = "zones" | "thresholds" | "categories" | "views";

const TABS: { id: Tab; label: string }[] = [
  { id: "zones", label: "ZONES" },
  { id: "thresholds", label: "THRESHOLDS" },
  { id: "categories", label: "CATEGORIES" },
  { id: "views", label: "VIEWS" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  demoActive?: boolean;
  onThresholdsApplied?: () => void;
}

export default function SettingsPanel({ open, onClose, demoActive, onThresholdsApplied }: Props) {
  const [tab, setTab] = useState<Tab>("thresholds");

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 40 }}
          />
          <motion.div
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            style={{
              position: "fixed", top: 0, right: 0, bottom: 0, width: 420, maxWidth: "100%",
              background: "var(--bg, #04070A)", borderLeft: "1px solid var(--hair, #21262D)",
              zIndex: 41, display: "flex", flexDirection: "column",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", padding: "14px 16px", borderBottom: "1px solid var(--hair-dim, #21262D)" }}>
              <span className="scope" style={{ fontSize: 12, letterSpacing: "0.1em", color: "var(--text-dim, #94A3B8)" }}>
                STATION CONFIGURATION
              </span>
              <button onClick={onClose} aria-label="Close settings" style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer" }}>
                <X size={18} color="var(--text-dim, #94A3B8)" />
              </button>
            </div>

            <div style={{ display: "flex", borderBottom: "1px solid var(--hair-dim, #21262D)" }}>
              {TABS.map((tb) => (
                <button
                  key={tb.id}
                  onClick={() => setTab(tb.id)}
                  className="scope"
                  style={{
                    flex: 1, padding: "10px 4px", fontSize: 10, letterSpacing: "0.06em",
                    background: "none", border: "none", cursor: "pointer",
                    color: tab === tb.id ? "var(--sweep, #29FF8C)" : "var(--text-faint, #64748B)",
                    borderBottom: tab === tb.id ? "2px solid var(--sweep, #29FF8C)" : "2px solid transparent",
                  }}
                >
                  {tb.label}
                </button>
              ))}
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
              {tab === "zones" && <ZonesTab />}
              {tab === "thresholds" && (
                <ThresholdsTab demoActive={demoActive} onApplied={onThresholdsApplied} />
              )}
              {tab === "categories" && <CategoriesTab />}
              {tab === "views" && <ViewsTab />}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
