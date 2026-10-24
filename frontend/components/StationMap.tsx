"use client";
import { motion } from "framer-motion";
import { ArrowUpDown, Lock, MinusCircle, TriangleAlert } from "lucide-react";
import type { ZoneState, ZonePrediction, GateState } from "@/lib/types";
import { BORDER_MAP } from "@/lib/constants";
import { useStationConfig } from "@/lib/config-context";

interface Props {
  zones: Record<string, ZoneState>;
  predictions?: Record<string, ZonePrediction>;
  showPredictions?: boolean;
  compact?: boolean;
  gateStates?: Record<string, GateState>;
  esc1Reversed?: boolean;
  esc2Reversed?: boolean;
  systemStatus?: string;
}

const CX = 280, CY = 280, R_MAX = 248, R_MIN = 40, HUB_R = 34;

// Density -> radius: closer to center is more severe, matching the graded
// threshold ladder (README "Density Thresholds Reference").
const RADIUS_POINTS: [number, number][] = [
  [0, 248], [5, 210], [6, 176], [7, 142], [7.5, 124], [8, 92], [10, 50],
];
function densityToRadius(d: number) {
  const clamped = Math.max(0, Math.min(d, 10));
  for (let i = 0; i < RADIUS_POINTS.length - 1; i++) {
    const [d0, r0] = RADIUS_POINTS[i];
    const [d1, r1] = RADIUS_POINTS[i + 1];
    if (clamped >= d0 && clamped <= d1) {
      const t = (clamped - d0) / (d1 - d0);
      return r0 + (r1 - r0) * t;
    }
  }
  return R_MIN;
}
function polar(bearingDeg: number, radius: number) {
  const rad = (bearingDeg * Math.PI) / 180;
  return { x: CX + radius * Math.sin(rad), y: CY - radius * Math.cos(rad) };
}

// Fixed bearings — a stylized severity scope, not a literal floor plan.
const BEARINGS: Record<string, number> = {
  GATE_B: 315, GATE_A: 345, GATE_C: 15,
  CONC: 42,
  FOB1: 70, FOB2: 100,
  P1: 145, P2: 159, P3: 173, P4: 187, P5: 201, P6: 215,
};
// Any zone id not in BEARINGS (i.e. one added through the no-code config UI)
// gets placed in the unused 220°-310° arc between P6 and GATE_B, spread
// evenly across however many such "extra" zones currently exist.
const EXTRA_ARC_START = 220, EXTRA_ARC_END = 310;
function bearingFor(id: string, extras: string[]): number {
  const fixed = BEARINGS[id];
  if (fixed !== undefined) return fixed;
  const idx = extras.indexOf(id);
  if (extras.length <= 1) return (EXTRA_ARC_START + EXTRA_ARC_END) / 2;
  return EXTRA_ARC_START + (idx / (extras.length - 1)) * (EXTRA_ARC_END - EXTRA_ARC_START);
}
const COMPACT_ORDER = ["GATE_B", "CONC", "FOB1", "FOB2", "P1", "P2", "P3"];

export default function StationMap({
  zones, predictions, showPredictions, compact, gateStates = {}, esc1Reversed, esc2Reversed, systemStatus,
}: Props) {
  const { config } = useStationConfig();
  const zoneIds = Object.keys(zones);
  const configuredOrder = config?.view.zone_display_order ?? zoneIds;
  const extras = configuredOrder.filter((id) => BEARINGS[id] === undefined);
  const t = config?.thresholds;
  const ringValues = t
    ? [t.l1_trigger, t.l2_trigger, t.pre_warn_trigger, t.l3_trigger, t.failsafe_trigger]
    : [5.0, 6.0, 7.0, 7.5, 8.0];
  const order = compact ? COMPACT_ORDER.filter((id) => zoneIds.includes(id)) : configuredOrder;

  // Station Threat Level for the center hub
  const resolvedStatus = systemStatus ?? (
    Object.values(zones).some((z) => z.color === "critical") ? "critical"
    : Object.values(zones).some((z) => z.color === "red") ? "active"
    : Object.values(zones).some((z) => z.color === "amber") ? "monitoring"
    : "normal"
  );
  const threatMeta: Record<string, { label: string; color: string }> = {
    normal:     { label: "NORMAL",     color: "#29FF8C" },
    monitoring: { label: "MONITOR",    color: "#16A35C" },
    active:     { label: "ELEVATED",   color: "#FFB020" },
    critical:   { label: "CRITICAL",   color: "#FF3B3B" },
  };
  const threat = threatMeta[resolvedStatus] ?? threatMeta.normal;
  const isThreatCritical = resolvedStatus === "critical";

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 0 }}>
      <svg
        viewBox="-24 -20 608 600"
        preserveAspectRatio="xMidYMid meet"
        style={{ width: "100%", height: "100%", maxHeight: "100%", maxWidth: "100%", display: "block" }}
      >
        <defs>
          <radialGradient id="radarDishGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#0d2b22" stopOpacity="0.4" />
            <stop offset="40%" stopColor="#051914" stopOpacity="0.25" />
            <stop offset="80%" stopColor="#030a0d" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#010406" stopOpacity="0.98" />
          </radialGradient>
          <radialGradient id="hubGlassGrad" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="rgba(30,55,48,0.9)" />
            <stop offset="100%" stopColor="rgba(4,9,13,0.95)" />
          </radialGradient>
          <filter id="radarGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="neonBlipGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <marker id="vecHead" markerWidth={6} markerHeight={6} refX={4} refY={3} orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="var(--text-dim)" />
          </marker>
        </defs>

        {/* Scope dish background */}
        <circle cx={CX} cy={CY} r={R_MAX} fill="url(#radarDishGrad)" />

        {/* Subtle concentric grid background rings (every 25px) */}
        {[30, 60, 90, 120, 150, 180, 210, 240].map((gr, idx) => (
          <circle key={`grid-ring-${idx}`} cx={CX} cy={CY} r={gr}
            fill="none" stroke="rgba(41,255,140,0.04)" strokeWidth={0.6} />
        ))}

        {/* Tactical Crosshair Axes & Quadrant Lines */}
        <line x1={CX - R_MAX} y1={CY} x2={CX + R_MAX} y2={CY}
          stroke="rgba(41,255,140,0.18)" strokeWidth={1} strokeDasharray="3 4" />
        <line x1={CX} y1={CY - R_MAX} x2={CX} y2={CY + R_MAX}
          stroke="rgba(41,255,140,0.18)" strokeWidth={1} strokeDasharray="3 4" />
        <line x1={CX - R_MAX * 0.707} y1={CY - R_MAX * 0.707} x2={CX + R_MAX * 0.707} y2={CY + R_MAX * 0.707}
          stroke="rgba(41,255,140,0.08)" strokeWidth={0.7} strokeDasharray="2 6" />
        <line x1={CX - R_MAX * 0.707} y1={CY + R_MAX * 0.707} x2={CX + R_MAX * 0.707} y2={CY - R_MAX * 0.707}
          stroke="rgba(41,255,140,0.08)" strokeWidth={0.7} strokeDasharray="2 6" />

        {/* Range rings — the threshold ladder with clear visible contrast */}
        {ringValues.map((v, i) => (
          <circle key={i} cx={CX} cy={CY} r={densityToRadius(v)}
            fill="none" stroke="rgba(41,255,140,0.22)" strokeWidth={1} strokeDasharray="4 4" />
        ))}

        {/* Outer boundary ring with high-visibility dual neon trace */}
        <circle cx={CX} cy={CY} r={R_MAX + 2} fill="none" stroke="rgba(41,255,140,0.12)" strokeWidth={3} />
        <circle cx={CX} cy={CY} r={R_MAX} fill="none" stroke="rgba(41,255,140,0.55)" strokeWidth={1.5} />
        <circle cx={CX} cy={CY} r={R_MAX - 3} fill="none" stroke="rgba(41,255,140,0.18)" strokeWidth={0.8} />

        {/* Azimuth Rim Ticks (Every 15° & 30°) */}
        {Array.from({ length: 24 }, (_, i) => {
          const deg = i * 15;
          const isMajor = deg % 30 === 0;
          const pOuter = polar(deg, R_MAX);
          const pInner = polar(deg, R_MAX - (isMajor ? 7 : 4));
          return (
            <line
              key={`tick-${deg}`}
              x1={pInner.x} y1={pInner.y} x2={pOuter.x} y2={pOuter.y}
              stroke={isMajor ? "rgba(41,255,140,0.7)" : "rgba(41,255,140,0.28)"}
              strokeWidth={isMajor ? 1.5 : 0.8}
            />
          );
        })}

        {/* Cardinal Compass Points with glowing HUD styling */}
        <text x={CX} y={CY - R_MAX - 7} textAnchor="middle" className="scope" fontSize={9.5} fontWeight={800} fill="var(--sweep)" letterSpacing="0.08em">N</text>
        <text x={CX + R_MAX + 11} y={CY + 3} textAnchor="start" className="scope" fontSize={8.5} fontWeight={800} fill="rgba(41,255,140,0.8)" letterSpacing="0.08em">E</text>
        <text x={CX} y={CY + R_MAX + 14} textAnchor="middle" className="scope" fontSize={8.5} fontWeight={800} fill="rgba(41,255,140,0.8)" letterSpacing="0.08em">S</text>
        <text x={CX - R_MAX - 11} y={CY + 3} textAnchor="end" className="scope" fontSize={8.5} fontWeight={800} fill="rgba(41,255,140,0.8)" letterSpacing="0.08em">W</text>

        {/* Threshold ladder labels, west side — crisp badges */}
        {!compact && ringValues.map((v, i) => {
          const r = densityToRadius(v);
          const yOffset = i % 2 === 0 ? -4 : 11;
          const valStr = v.toFixed(1);
          return (
            <g key={i}>
              <line x1={CX - r} y1={CY - 3} x2={CX - r} y2={CY + 3} stroke="rgba(41,255,140,0.6)" strokeWidth={1.2} />
              <rect
                x={CX - r - 26}
                y={CY + yOffset - 8}
                width={23}
                height={10}
                rx={2.5}
                fill="rgba(4,9,14,0.92)"
                stroke="rgba(41,255,140,0.4)"
                strokeWidth={0.8}
                style={{ filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.8))" }}
              />
              <text x={CX - r - 15} y={CY + yOffset} textAnchor="middle"
                className="scope" fontSize={8} fontWeight={700} fill="var(--sweep)" letterSpacing="0.02em">
                {valStr}
              </text>
            </g>
          );
        })}

        {/* Rotating sweep with trailing persistence fan */}
        <motion.g
          style={{ transformOrigin: `${CX}px ${CY}px` }}
          animate={{ rotate: 360 }}
          transition={{ duration: 7, repeat: Infinity, ease: "linear" }}
        >
          {[32, 28, 24, 20, 16, 12, 9, 6, 3, 0].map((offset, i) => {
            const p = polar(-offset, R_MAX);
            const isLead = offset === 0;
            return (
              <line key={i} x1={CX} y1={CY} x2={p.x} y2={p.y}
                stroke="var(--sweep)" strokeWidth={isLead ? 2 : 1}
                opacity={isLead ? 1 : 0.32 - i * 0.03}
                style={isLead ? { filter: "drop-shadow(0 0 6px var(--sweep))" } : undefined} />
            );
          })}
        </motion.g>

        {/* Predicted trajectory vectors */}
        {showPredictions && order.map((id) => {
          const bearing = bearingFor(id, extras);
          const pred = predictions?.[id];
          const state = zones[id];
          if (!pred || !state) return null;
          const from = polar(bearing, densityToRadius(state.density));
          const to = polar(bearing, densityToRadius(pred.t90.density));
          if (Math.abs(from.x - to.x) < 1 && Math.abs(from.y - to.y) < 1) return null;
          return (
            <line key={`vec-${id}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y}
              stroke={BORDER_MAP[pred.t90.color]} strokeWidth={1.5}
              strokeDasharray="2 3" opacity={0.8} markerEnd="url(#vecHead)" />
          );
        })}

        {/* Center Hub — Station Threat Level */}
        {/* Center Hub — Station Threat Level */}
        <motion.circle cx={CX} cy={CY} r={HUB_R + 3}
          fill="url(#hubGlassGrad)" stroke={threat.color} strokeWidth={1.8}
          animate={isThreatCritical ? { opacity: [1, 0.45, 1], scale: [1, 1.05, 1] } : {}}
          transition={{ duration: 0.9, repeat: Infinity }}
          style={{ filter: `drop-shadow(0 0 8px ${threat.color}44)` }} />
        <circle cx={CX} cy={CY} r={HUB_R - 3} fill="none" stroke="rgba(41,255,140,0.22)" strokeWidth={1} strokeDasharray="2 3" />
        <text x={CX} y={CY - 12} textAnchor="middle" className="scope" fontSize={7.5} fontWeight={600}
          fill="var(--text-faint)" letterSpacing="0.12em">STATION</text>
        <text x={CX} y={CY - 3} textAnchor="middle" className="scope" fontSize={7.5} fontWeight={600}
          fill="var(--text-faint)" letterSpacing="0.12em">THREAT</text>
        <text x={CX} y={CY + 11} textAnchor="middle" className="scope" fontWeight={800}
          fontSize={10.5} fill={threat.color} letterSpacing="0.08em">{threat.label}</text>

        {/* Contacts */}
        {order.map((id) => {
          const bearing = bearingFor(id, extras);
          const state = zones[id];
          const color = BORDER_MAP[state?.color ?? "green"];
          const critical = state?.color === "critical";
          const elevated = state?.color === "amber" || state?.color === "red";
          const r = densityToRadius(state?.density ?? 0);
          const p = polar(bearing, r);
          const isRight = Math.sin((bearing * Math.PI) / 180) >= -0.05;
          const labelR = r + (compact ? 14 : 18);
          const lp = polar(bearing, labelR);
          const gate = id.startsWith("GATE_") ? (gateStates[id] ?? "open") : null;
          const escReversed = id === "FOB1" ? esc1Reversed : id === "FOB2" ? esc2Reversed : false;
          const zoneLabel = config?.zones.find((z) => z.id === id)?.short_label ?? id;
          const densityVal = (state?.density ?? 0).toFixed(1);

          return (
            <g key={id}>
              {/* Leader hairline connecting blip to label */}
              <line
                x1={p.x} y1={p.y}
                x2={lp.x + (isRight ? -3 : 3)} y2={lp.y}
                stroke={color} strokeWidth={0.8} strokeDasharray="2 2" opacity={0.65}
              />

              {/* Pulsing ring for critical/elevated */}
              {(critical || elevated) && (
                <motion.circle cx={p.x} cy={p.y} r={10} fill="none" stroke={color} strokeWidth={1.5}
                  animate={{ scale: [1, critical ? 2.3 : 1.8], opacity: [0.9, 0] }}
                  transition={{ duration: critical ? 0.9 : 1.4, repeat: Infinity }} style={{ transformOrigin: `${p.x}px ${p.y}px` }} />
              )}

              {/* Target reticle halo */}
              <circle cx={p.x} cy={p.y} r={7.5} fill="none" stroke={color} strokeWidth={0.8} opacity={0.5} />
              {/* Core blip dot with neon glow */}
              <circle cx={p.x} cy={p.y} r={4.5} fill={color} stroke="#04090D" strokeWidth={1.5}
                style={{ filter: `drop-shadow(0 0 5px ${color})` }} />

              {id === "FOB1" && (
                <TriangleAlert
                  x={isRight ? lp.x - (compact ? 1 : 2) : lp.x - (compact ? 32 : 42)}
                  y={lp.y - (compact ? 15 : 18)}
                  size={compact ? 9 : 11} color="var(--prewarn)" strokeWidth={2}
                />
              )}

              {/* Tactical HUD Chip Container */}
              <g transform={`translate(${lp.x + (isRight ? 2 : -2)}, ${lp.y})`}>
                <rect
                  x={isRight ? 0 : -(compact ? 54 : 64)}
                  y={compact ? -12 : -13}
                  width={compact ? 54 : 64}
                  height={compact ? 24 : 26}
                  rx={3}
                  fill="rgba(4, 9, 14, 0.88)"
                  stroke={critical ? "var(--red)" : elevated ? color : "rgba(41,255,140,0.22)"}
                  strokeWidth={critical ? 1.4 : 0.8}
                  style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.85))" }}
                />
                <text
                  x={isRight ? 6 : -6}
                  y={compact ? -2 : -2}
                  textAnchor={isRight ? "start" : "end"}
                  className="scope"
                  fontSize={compact ? 8 : 9}
                  fontWeight={600}
                  fill="#D8F5EB"
                  letterSpacing="0.05em"
                >
                  {zoneLabel}
                </text>
                <text
                  x={isRight ? 6 : -6}
                  y={compact ? 8 : 9.5}
                  textAnchor={isRight ? "start" : "end"}
                  className="scope"
                  fontWeight={700}
                  fontSize={compact ? 9.5 : 11}
                  fill={color}
                  style={{ filter: `drop-shadow(0 0 4px ${color}88)` }}
                >
                  {densityVal} <tspan fontSize={compact ? 6.5 : 7.5} fill="var(--text-faint)" fontWeight={400}>/m²</tspan>
                </text>
              </g>

              {gate && gate !== "open" && (
                <g transform={`translate(${p.x}, ${p.y})`}>
                  {gate === "closed" ? (
                    <Lock x={isRight ? -30 : 18} y={-7} size={13} color={color} strokeWidth={1.75} />
                  ) : (
                    <MinusCircle x={isRight ? -30 : 18} y={-7} size={13} color={color} strokeWidth={1.75} />
                  )}
                </g>
              )}
              {escReversed && (
                <ArrowUpDown x={lp.x - 6} y={lp.y + (compact ? 12 : 16)} size={12} color="var(--amber)" strokeWidth={1.75} />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

