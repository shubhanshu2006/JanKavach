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
    <div style={{ position: "relative", width: "100%" }}>
      <svg viewBox="0 0 560 560" style={{ width: "100%", height: "auto", display: "block" }}>
        {/* Range rings — the threshold ladder. Keyed by index, not value: two
            adjacent thresholds (e.g. pre_warn_trigger and l3_trigger) are allowed
            to be set equal, which would otherwise collide as a React key. */}
        {ringValues.map((v, i) => (
          <circle key={i} cx={CX} cy={CY} r={densityToRadius(v)}
            fill="none" stroke="var(--hair)" strokeWidth={1} />
        ))}
        <circle cx={CX} cy={CY} r={R_MAX} fill="none" stroke="var(--hair)" strokeWidth={1.5} />

        {/* Threshold ladder labels, west side */}
        {!compact && ringValues.map((v, i) => {
          const r = densityToRadius(v);
          return (
            <text key={i} x={CX - r - 6} y={CY + 3} textAnchor="end"
              className="scope" fontSize={9} fill="var(--text-faint)" letterSpacing="0.05em">
              {v.toFixed(1)}
            </text>
          );
        })}

        {/* Rotating sweep with trailing persistence fan */}
        <motion.g
          style={{ transformOrigin: `${CX}px ${CY}px` }}
          animate={{ rotate: 360 }}
          transition={{ duration: 7, repeat: Infinity, ease: "linear" }}
        >
          {[18, 14, 10, 6, 3, 0].map((offset, i) => {
            const p = polar(-offset, R_MAX);
            return (
              <line key={i} x1={CX} y1={CY} x2={p.x} y2={p.y}
                stroke="var(--sweep)" strokeWidth={offset === 0 ? 1.4 : 1}
                opacity={offset === 0 ? 0.9 : 0.22 - i * 0.03} />
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
              stroke={BORDER_MAP[pred.t90.color]} strokeWidth={1.4}
              strokeDasharray="2 3" opacity={0.75} markerEnd="url(#vecHead)" />
          );
        })}

        <defs>
          <marker id="vecHead" markerWidth={6} markerHeight={6} refX={4} refY={3} orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="var(--text-dim)" />
          </marker>
        </defs>

        {/* Center Hub — Station Threat Level */}
        <motion.circle cx={CX} cy={CY} r={HUB_R}
          fill={threat.color + "18"} stroke={threat.color} strokeWidth={1.8}
          animate={isThreatCritical ? { opacity: [1, 0.45, 1], scale: [1, 1.05, 1] } : {}}
          transition={{ duration: 0.9, repeat: Infinity }} />
        <text x={CX} y={CY - 12} textAnchor="middle" className="scope" fontSize={7}
          fill="var(--text-faint)" letterSpacing="0.1em">STATION</text>
        <text x={CX} y={CY - 3} textAnchor="middle" className="scope" fontSize={7}
          fill="var(--text-faint)" letterSpacing="0.1em">THREAT</text>
        <text x={CX} y={CY + 11} textAnchor="middle" className="scope" fontWeight={700}
          fontSize={10.5} fill={threat.color} letterSpacing="0.08em">{threat.label}</text>

        {/* Contacts */}
        {order.map((id) => {
          const bearing = bearingFor(id, extras);
          const state = zones[id];
          const color = BORDER_MAP[state?.color ?? "green"];
          const critical = state?.color === "critical";
          const r = densityToRadius(state?.density ?? 0);
          const p = polar(bearing, r);
          const isRight = Math.sin((bearing * Math.PI) / 180) >= -0.05;
          const labelR = r + (compact ? 14 : 18);
          const lp = polar(bearing, labelR);
          const gate = id.startsWith("GATE_") ? (gateStates[id] ?? "open") : null;
          const escReversed = id === "FOB1" ? esc1Reversed : id === "FOB2" ? esc2Reversed : false;

          return (
            <g key={id}>
              {critical && (
                <motion.circle cx={p.x} cy={p.y} r={9} fill="none" stroke={color} strokeWidth={1.5}
                  animate={{ scale: [1, 1.9], opacity: [0.8, 0] }}
                  transition={{ duration: 1, repeat: Infinity }} style={{ transformOrigin: `${p.x}px ${p.y}px` }} />
              )}
              <circle cx={p.x} cy={p.y} r={5} fill={color} stroke="var(--bg)" strokeWidth={1} />

              {id === "FOB1" && (
                <TriangleAlert
                  x={isRight ? lp.x - (compact ? 1 : 2) : lp.x - (compact ? 32 : 42)}
                  y={lp.y - (compact ? 15 : 18)}
                  size={compact ? 9 : 11} color="var(--prewarn)" strokeWidth={2}
                />
              )}
              <text x={lp.x} y={lp.y - 3} textAnchor={isRight ? "start" : "end"}
                className="scope" fontSize={compact ? 8 : 9.5} fill="var(--text-dim)" letterSpacing="0.04em">
                {config?.zones.find((z) => z.id === id)?.short_label ?? id}
              </text>
              <text x={lp.x} y={lp.y + (compact ? 8 : 10)} textAnchor={isRight ? "start" : "end"}
                className="scope" fontWeight={700} fontSize={compact ? 10 : 12} fill={color}>
                {(state?.density ?? 0).toFixed(1)}
              </text>

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
