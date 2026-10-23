"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { API_URL } from "@/lib/constants";

export interface VideoSource {
  key: string;
  label: string;
  url: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (source: VideoSource) => void;
}

/** CCTV-wall style picker: every discovered camera feed plays live and small;
 * clicking one hands it off to the caller to enlarge + run detection on. */
export default function VideoSourcePicker({ open, onClose, onSelect }: Props) {
  const [sources, setSources] = useState<VideoSource[] | null>(null);

  useEffect(() => {
    if (!open) return;
    setSources(null);
    fetch(`${API_URL}/live/sources`)
      .then((r) => r.json())
      .then((d) => setSources(d.sources ?? []))
      .catch(() => setSources([]));
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 50,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          {/* Centered via the backdrop's flexbox, not a translate(-50%,-50%) transform —
              framer-motion owns the transform property once `animate` includes scale,
              so a manually-set translate string here gets silently dropped, leaving
              this at top:0/left:0 of wherever it sits and overflowing off-screen. */}
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            style={{
              width: "min(920px, 92vw)", maxHeight: "86vh",
              background: "var(--bg, #04070A)", border: "1px solid var(--hair, #21262D)",
              display: "flex", flexDirection: "column", overflow: "hidden",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid var(--hair-dim, #21262D)", flexShrink: 0 }}>
              <span className="scope" style={{ fontSize: 12, letterSpacing: "0.1em", color: "var(--text-dim, #94A3B8)" }}>
                SELECT CAMERA FEED
              </span>
              <span className="scope" style={{ marginLeft: 10, fontSize: 10, color: "var(--text-faint, #64748B)" }}>
                {sources ? `${sources.length} SOURCES` : "SCANNING…"}
              </span>
              <button onClick={onClose} aria-label="Close" style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer" }}>
                <X size={18} color="var(--text-dim, #94A3B8)" />
              </button>
            </div>

            <div className="scrollbar-thin" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 16 }}>
              {sources && sources.length === 0 && (
                <div className="scope" style={{ fontSize: 11, color: "var(--text-faint, #64748B)", textAlign: "center", padding: 40 }}>
                  NO VIDEO SOURCES FOUND
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
                {(sources ?? Array.from({ length: 4 })).map((s, i) => (
                  <SourceTile key={s ? (s as VideoSource).key : i} source={s as VideoSource | undefined} onSelect={onSelect} />
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SourceTile({ source, onSelect }: { source?: VideoSource; onSelect: (s: VideoSource) => void }) {
  if (!source) {
    return (
      <div style={{ aspectRatio: "16/9", background: "var(--panel-2, #0A0F14)", border: "1px solid var(--hair-dim, #21262D)" }} />
    );
  }
  return (
    <button
      onClick={() => onSelect(source)}
      style={{
        position: "relative", aspectRatio: "16/9", background: "#000",
        border: "1px solid var(--hair, #21262D)", cursor: "pointer", padding: 0, overflow: "hidden",
        textAlign: "left",
      }}
      className="cctv-tile"
    >
      <video
        src={`${API_URL}${source.url}`}
        autoPlay loop muted playsInline
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
      <div style={{ position: "absolute", top: 6, left: 6, display: "flex", alignItems: "center", gap: 4 }}>
        <motion.div
          style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--red, #FF3B3B)" }}
          animate={{ opacity: [1, 0.2, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
        />
        <span className="scope" style={{ fontSize: 8, color: "#fff", letterSpacing: "0.08em", textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}>
          LIVE
        </span>
      </div>
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: "linear-gradient(transparent, rgba(0,0,0,0.85))",
        padding: "14px 8px 6px",
      }}>
        <span className="scope" style={{ fontSize: 10, color: "var(--sweep, #29FF8C)", letterSpacing: "0.08em" }}>
          {source.label}
        </span>
      </div>
    </button>
  );
}
