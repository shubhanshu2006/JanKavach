"use client";
import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, TriangleAlert, Video } from "lucide-react";
import type { PersonBbox } from "@/lib/types";

interface Props {
  critical: boolean;
  videoSrc?: string;
  persons?: PersonBbox[];
  showTracking?: boolean;
}

export default function VideoPlayer({
  critical,
  videoSrc = "/videos/platform.webm",
  persons = [],
  showTracking = false,
}: Props) {
  const videoRef   = useRef<HTMLVideoElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const rafRef     = useRef<number>(0);
  const [hasVideo, setHasVideo] = useState(false);
  const [hidden, setHidden]     = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onCanPlay = () => setHasVideo(true);
    const onError   = () => setHasVideo(false);
    v.addEventListener("canplay", onCanPlay);
    v.addEventListener("error", onError);
    v.load();
    return () => {
      v.removeEventListener("canplay", onCanPlay);
      v.removeEventListener("error", onError);
    };
  }, [videoSrc]);

  useEffect(() => {
    if (!videoRef.current || !hasVideo) return;
    videoRef.current.playbackRate = critical ? 1.4 : 1.0;
  }, [critical, hasVideo]);

  useEffect(() => {
    if (!showTracking) {
      cancelAnimationFrame(rafRef.current);
      return;
    }
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
      ctx.fillStyle = "rgba(41,255,140,0.04)";
      ctx.fillRect(0, 0, W, H);

      ctx.lineWidth = 1.2;
      for (const p of persons) {
        const x = p.x1 * W;
        const y = p.y1 * H;
        const w = (p.x2 - p.x1) * W;
        const h = (p.y2 - p.y1) * H;
        ctx.strokeStyle = "#29FF8C";
        ctx.strokeRect(x, y, w, h);
        ctx.fillStyle = "#29FF8C";
        ctx.fillRect(x, y, 3, 1);
        ctx.fillRect(x, y, 1, 3);
        ctx.fillRect(x + w - 3, y, 3, 1);
        ctx.fillRect(x + w - 1, y, 1, 3);
      }

      if (persons.length > 0) {
        ctx.fillStyle = "rgba(41,255,140,0.8)";
        ctx.fillRect(4, 4, 56, 14);
        ctx.fillStyle = "#04120B";
        ctx.font = "bold 8px monospace";
        ctx.fillText(`${persons.length} PERSONS`, 7, 14);
      }

      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [showTracking, persons]);

  if (hidden) {
    return (
      <button
        onClick={() => setHidden(false)}
        className="scope"
        style={{
          position: "fixed", bottom: 16, left: 16, zIndex: 40,
          display: "flex", alignItems: "center", gap: 6,
          height: 28, padding: "0 12px", fontSize: 10,
          background: "var(--panel)", color: "var(--text-mute)",
          border: "1px solid var(--hair)", cursor: "pointer", letterSpacing: "0.08em",
        }}
      >
        <Video size={12} strokeWidth={1.75} /> SHOW CCTV
      </button>
    );
  }

  const trackingWidth = 480;
  const normalWidth   = 220;
  const widgetWidth   = showTracking ? trackingWidth : normalWidth;

  return (
    <motion.div
      style={{ position: "fixed", bottom: 16, left: 16, zIndex: 40 }}
      animate={{ width: widgetWidth }}
      transition={{ type: "spring", stiffness: 180, damping: 22 }}
    >
      <div className="panel" style={{
        borderColor: critical ? "var(--red)" : showTracking ? "var(--sweep-dim)" : "var(--hair)",
        overflow: "hidden",
        position: "relative",
      }}>
        <AnimatePresence>
          {critical && (
            <motion.div
              style={{ position: "absolute", inset: 0, border: "1px solid var(--red)", pointerEvents: "none", zIndex: 10 }}
              animate={{ opacity: [1, 0.2, 1] }}
              transition={{ duration: 0.7, repeat: Infinity }}
            />
          )}
        </AnimatePresence>

        <div className="scope" style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "5px 8px",
          background: "var(--panel-2)", borderBottom: "1px solid var(--hair-dim)",
        }}>
          <motion.div
            style={{ width: 6, height: 6, borderRadius: "50%", background: hasVideo ? "var(--red)" : "var(--text-faint)" }}
            animate={hasVideo ? { opacity: [1, 0.3, 1] } : {}}
            transition={{ duration: 1, repeat: Infinity }}
          />
          <span style={{ fontSize: 10, color: "var(--text-mute)", letterSpacing: "0.1em" }}>
            {showTracking ? "CCTV · AI TRACK" : "LIVE CCTV"}
          </span>
          {critical && (
            <motion.span
              style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 9, color: "var(--red)", letterSpacing: "0.06em" }}
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 0.5, repeat: Infinity }}
            >
              <TriangleAlert size={10} strokeWidth={1.75} /> HIGH DENSITY
            </motion.span>
          )}
          <button
            onClick={() => setHidden(true)}
            style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", padding: "0 2px", display: "flex" }}
          >
            <X size={12} strokeWidth={1.75} />
          </button>
        </div>

        {showTracking ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
            <div style={{ position: "relative" }}>
              <div className="scope" style={{
                fontSize: 8, color: "var(--text-faint)", letterSpacing: "0.1em",
                padding: "2px 6px", background: "var(--panel-2)",
                borderBottom: "1px solid var(--hair-dim)", borderRight: "1px solid var(--hair-dim)",
              }}>
                RAW FEED
              </div>
              <div style={{ position: "relative", aspectRatio: "16/9" }}>
                <video
                  ref={videoRef}
                  src={videoSrc}
                  autoPlay loop muted playsInline
                  style={{
                    width: "100%", height: "100%", objectFit: "cover",
                    display: hasVideo ? "block" : "none",
                    borderRight: "1px solid var(--hair-dim)",
                  }}
                />
                {!hasVideo && <PlaceholderDots />}
              </div>
            </div>

            <div style={{ position: "relative" }}>
              <div className="scope" style={{
                fontSize: 8, color: "var(--sweep-dim)", letterSpacing: "0.1em",
                padding: "2px 6px", background: "#04140C",
                borderBottom: "1px solid var(--hair-dim)",
              }}>
                AI TRACKING
              </div>
              <div style={{ position: "relative", aspectRatio: "16/9" }}>
                {hasVideo ? (
                  <canvas
                    ref={canvasRef}
                    width={240} height={135}
                    style={{ width: "100%", height: "100%", display: "block" }}
                  />
                ) : (
                  <PlaceholderDots />
                )}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ position: "relative", aspectRatio: "16/9" }}>
            <video
              ref={videoRef}
              src={videoSrc}
              autoPlay loop muted playsInline
              style={{ width: "100%", height: "100%", objectFit: "cover", display: hasVideo ? "block" : "none" }}
            />
            {!hasVideo && <PlaceholderDots />}
            {critical && (
              <div style={{
                position: "absolute", top: 4, right: 4,
                background: "rgba(255,59,59,0.8)", border: "1px solid var(--red)",
                padding: "1px 6px",
              }}>
                <span className="scope" style={{ fontSize: 9, color: "#FFE0E0" }}>CRITICAL</span>
              </div>
            )}
          </div>
        )}

        <div className="scope" style={{
          padding: "3px 8px",
          background: "var(--panel-2)", borderTop: "1px solid var(--hair-dim)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontSize: 9, color: "var(--text-faint)", letterSpacing: "0.06em" }}>
            {showTracking ? `${persons.length} DETECTED` : "FOB-3 · PIP"}
          </span>
          <span style={{ fontSize: 9, color: "var(--text-faint)" }}>
            {showTracking ? "YOLO+SAHI" : "CCTV"}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

function PlaceholderDots() {
  return (
    <div style={{ position: "absolute", inset: 0, background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span className="scope" style={{ fontSize: 9, color: "var(--text-faint)", letterSpacing: "0.08em" }}>
        NO SIGNAL
      </span>
    </div>
  );
}
