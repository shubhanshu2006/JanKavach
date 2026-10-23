"use client";
import { useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { PersonBbox, ZoneState } from "@/lib/types";
import { BORDER_MAP } from "@/lib/constants";

interface Props {
  videoSrc: string;
  persons: PersonBbox[];
  zones: Record<string, ZoneState>;
  loading: boolean;
  /** Display label for the selected camera feed, e.g. "CAM 01". */
  source: string;
}

const LERP = 0.42; // per-frame lerp speed — at 60fps, box reaches target in ~5 frames (~80ms)
const SWEEP = "#29FF8C";

/** Centroid distance between two boxes (normalized coords) */
function centDist(a: PersonBbox, b: PersonBbox) {
  return Math.hypot((a.x1+a.x2)/2-(b.x1+b.x2)/2, (a.y1+a.y2)/2-(b.y1+b.y2)/2);
}

/** Greedy centroid matching: pair each target box to the nearest current box */
function matchLerp(curr: PersonBbox[], target: PersonBbox[], t: number): PersonBbox[] {
  if (curr.length === 0) return target;
  if (t >= 1) return target;
  const used = new Set<number>();
  return target.map(tp => {
    let bestDist = 0.35, bestIdx = -1;
    curr.forEach((cp, i) => {
      if (used.has(i)) return;
      const d = centDist(tp, cp);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    });
    if (bestIdx === -1) return tp;
    used.add(bestIdx);
    const cp = curr[bestIdx];
    return {
      x1: cp.x1 + (tp.x1 - cp.x1) * t,
      y1: cp.y1 + (tp.y1 - cp.y1) * t,
      x2: cp.x2 + (tp.x2 - cp.x2) * t,
      y2: cp.y2 + (tp.y2 - cp.y2) * t,
    };
  });
}

export default function VideoTrackingView({ videoSrc, persons, zones, loading, source }: Props) {
  const videoRef      = useRef<HTMLVideoElement>(null);
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const rafRef        = useRef<number>(0);
  const personsRef    = useRef<PersonBbox[]>([]); // raw latest from backend
  const animRef       = useRef<PersonBbox[]>([]); // smoothly animated positions
  const targetRef     = useRef<PersonBbox[]>([]); // target for current lerp step
  const [hasVideo, setHasVideo] = useState(false);

  // When backend delivers new positions, update lerp target + count ref
  useEffect(() => {
    targetRef.current  = persons;
    personsRef.current = persons;
  }, [persons]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    setHasVideo(false);
    const onCanPlay = () => setHasVideo(true);
    const onError   = () => setHasVideo(false);
    v.addEventListener("canplay", onCanPlay);
    v.addEventListener("error", onError);
    v.load();
    // Fallback: poll readyState in case canplay fires before listener attached
    const poll = setInterval(() => {
      if (v.readyState >= 3) { setHasVideo(true); clearInterval(poll); }
    }, 200);
    return () => {
      v.removeEventListener("canplay", onCanPlay);
      v.removeEventListener("error", onError);
      clearInterval(poll);
    };
  }, [videoSrc]);

  // RAF loop: always running — mirrors video to canvas, overlays bboxes when available
  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    const draw = () => {
      const canvas = canvasRef.current;
      const video  = videoRef.current;
      if (!canvas || !video || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }
      const W = canvas.width;
      const H = canvas.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { rafRef.current = requestAnimationFrame(draw); return; }

      ctx.drawImage(video, 0, 0, W, H);

      // Subtle phosphor scan-line tint
      ctx.fillStyle = "rgba(41,255,140,0.03)";
      ctx.fillRect(0, 0, W, H);

      // Lerp animated positions toward latest targets each frame
      animRef.current = matchLerp(animRef.current, targetRef.current, LERP);

      // Draw person bboxes — OpenCV style
      ctx.lineWidth = 1.5;
      animRef.current.forEach((p, i) => {
        const x = p.x1 * W;
        const y = p.y1 * H;
        const w = (p.x2 - p.x1) * W;
        const h = (p.y2 - p.y1) * H;

        ctx.strokeStyle = SWEEP;
        ctx.strokeRect(x, y, w, h);

        // Corner ticks (OpenCV aesthetic)
        const tk = Math.min(8, w * 0.25, h * 0.25);
        ctx.fillStyle = SWEEP;
        [[x,y],[x+w,y],[x,y+h],[x+w,y+h]].forEach(([cx,cy]) => {
          ctx.fillRect(cx - 1, cy - 1, 2, 2);
        });
        ctx.beginPath();
        ctx.moveTo(x, y + tk); ctx.lineTo(x, y); ctx.lineTo(x + tk, y);
        ctx.moveTo(x + w - tk, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + tk);
        ctx.moveTo(x, y + h - tk); ctx.lineTo(x, y + h); ctx.lineTo(x + tk, y + h);
        ctx.moveTo(x + w - tk, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - tk);
        ctx.strokeStyle = "#7DFFB8";
        ctx.lineWidth = 1;
        ctx.stroke();

        if (w > 20) {
          ctx.fillStyle = "rgba(41,255,140,0.85)";
          ctx.fillRect(x, y - 13, 28, 12);
          ctx.fillStyle = "#04120B";
          ctx.font = "bold 8px monospace";
          ctx.fillText(`P${i + 1}`, x + 3, y - 3);
        }
      });

      const label = `${personsRef.current.length} PERSONS`;
      ctx.fillStyle = "rgba(4,18,11,0.75)";
      ctx.fillRect(6, 6, label.length * 6.5 + 10, 18);
      ctx.fillStyle = SWEEP;
      ctx.font = "bold 10px monospace";
      ctx.fillText(label, 11, 19);

      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const p1 = zones["P1"];
  const density = p1?.density ?? 0;
  const color   = BORDER_MAP[p1?.color ?? "green"];
  const count   = p1?.count ?? 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>

        <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div className="scope" style={{
            fontSize: 9, color: "var(--text-faint)", letterSpacing: "0.12em",
            padding: "4px 10px", background: "var(--panel-2)", borderBottom: "1px solid var(--hair-dim)",
            flexShrink: 0,
          }}>
            RAW CCTV — {source}
          </div>
          <div style={{ flex: 1, minHeight: 0, position: "relative", background: "var(--bg)" }}>
            <video
              ref={videoRef}
              src={videoSrc}
              autoPlay loop muted playsInline
              style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }}
            />
            {!hasVideo && (
              <div style={{
                position: "absolute", inset: 0, background: "var(--bg)", zIndex: 2,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <motion.div
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.4, repeat: Infinity }}
                  className="scope"
                  style={{ fontSize: 10, color: "var(--text-faint)", letterSpacing: "0.1em" }}
                >
                  LOADING FEED...
                </motion.div>
              </div>
            )}
            <div style={{ position: "absolute", top: 8, left: 8, display: "flex", alignItems: "center", gap: 5 }}>
              <motion.div
                style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--red)" }}
                animate={{ opacity: [1, 0.2, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
              <span className="scope" style={{ fontSize: 9, color: "var(--red)", letterSpacing: "0.1em" }}>LIVE</span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div className="scope" style={{
            fontSize: 9, letterSpacing: "0.12em",
            padding: "4px 10px", background: "var(--panel-2)", borderBottom: "1px solid var(--hair-dim)",
            flexShrink: 0, display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ color: "var(--sweep-dim)" }}>AI TRACKING — YOLOv8m + SAHI</span>
            <span style={{ color: "var(--red)" }}>● LIVE INFERENCE</span>
            <span style={{ marginLeft: "auto", color: "var(--text-faint)" }}>{persons.length} DET · CPU ~1.5–5 FPS</span>
          </div>
          <div style={{ flex: 1, minHeight: 0, position: "relative", background: "#020504" }}>
            <canvas
              ref={canvasRef}
              width={640} height={480}
              style={{ width: "100%", height: "100%", display: "block" }}
            />

            {loading && (
              <div style={{
                position: "absolute", inset: 0, background: "rgba(2,5,4,0.85)",
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 10,
              }}>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                  style={{
                    width: 22, height: 22,
                    border: "2px solid var(--hair)",
                    borderTop: "2px solid var(--sweep)",
                    borderRadius: "50%",
                  }}
                />
                <span className="scope" style={{ fontSize: 10, color: "var(--sweep-dim)", letterSpacing: "0.12em" }}>
                  LOADING MODEL...
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="scope" style={{
        flexShrink: 0,
        display: "flex", alignItems: "center", gap: 0,
        background: "var(--panel-2)", borderTop: "1px solid var(--hair-dim)",
        fontSize: 10,
      }}>
        <StatCell label="PERSONS" value={String(count)} color={color} />
        <StatCell label="DENSITY" value={`${density.toFixed(2)}/m²`} color={color} />
        <StatCell label="STATUS" value={p1?.color?.toUpperCase() ?? "—"} color={color} />
        <StatCell label="SOURCE" value={source} color="var(--text-mute)" />
        <StatCell label="MODEL" value="YOLOv8m" color="var(--text-faint)" />
      </div>
    </div>
  );
}

function StatCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      padding: "6px 14px", borderRight: "1px solid var(--hair-dim)",
      display: "flex", flexDirection: "column", gap: 2,
    }}>
      <span style={{ fontSize: 8, color: "var(--text-faint)", letterSpacing: "0.1em" }}>{label}</span>
      <span style={{ fontSize: 12, color, letterSpacing: "0.06em" }}>{value}</span>
    </div>
  );
}
