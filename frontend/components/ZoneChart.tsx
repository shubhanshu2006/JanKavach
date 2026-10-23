"use client";
import type { ZoneState } from "@/lib/types";
import { BORDER_MAP } from "@/lib/constants";
import { useStationConfig } from "@/lib/config-context";

interface Props {
  zones: Record<string, ZoneState>;
  historyMap: Record<string, number[]>;
}

const TRACKED = ["CONC", "FOB1", "FOB2", "P1", "P2", "P3", "P4"];
const STATUS_META: Record<string, { label: string; bg: string }> = {
  green:    { label: "NORMAL", bg: "rgba(41,255,140,0.12)" },
  amber:    { label: "ELEV",   bg: "rgba(255,176,32,0.14)" },
  red:      { label: "HIGH",   bg: "rgba(255,59,59,0.16)" },
  critical: { label: "CRIT",   bg: "rgba(255,26,26,0.22)" },
};

export default function ZoneChart({ zones, historyMap }: Props) {
  const { config } = useStationConfig();
  return (
    <div style={{ overflowX: "auto", minWidth: 320 }}>
      <div className="scope" style={{
        display: "flex", alignItems: "center",
        padding: "5px 14px",
        fontSize: 9, color: "var(--text-faint)", letterSpacing: "0.1em",
        borderBottom: "1px solid var(--hair-dim)",
        background: "var(--panel-2)",
        position: "sticky",
        top: 0,
        zIndex: 2,
      }}>
        <span style={{ width: 90 }}>ZONE</span>
        <span style={{ width: 84, textAlign: "right" }}>DENSITY</span>
        <span style={{ width: 48, textAlign: "right" }}>PERSONS</span>
        <span style={{ flex: 1, textAlign: "center" }}>30s TREND</span>
        <span style={{ width: 54, textAlign: "right" }}>STATUS</span>
      </div>


      {TRACKED.map(zid => {
        const state = zones[zid];
        if (!state) return null;
        return (
          <ZoneRow
            key={zid}
            label={config?.zones.find((z) => z.id === zid)?.short_label ?? zid}
            state={state}
            history={historyMap[zid] ?? []}
          />
        );
      })}
    </div>
  );
}

function ZoneRow({ label, state, history }: { label: string; state: ZoneState; history: number[] }) {
  const color = BORDER_MAP[state.color];
  const sMeta = STATUS_META[state.color] ?? { label: "---", bg: "transparent" };
  const isCrit = state.color === "critical";

  const W = 110, H = 16;
  const max = Math.max(...history, 1);
  const pts = history.slice(-24).map((v, i, arr) => {
    const x = (i / Math.max(arr.length - 1, 1)) * W;
    const y = H - (v / max) * H;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  return (
    <div className="scope transition-colors" style={{
      display: "flex", alignItems: "center",
      padding: "6px 14px",
      borderBottom: "1px solid var(--hair-dim)",
      background: isCrit ? "rgba(255,26,26,0.08)" : "transparent",
      fontSize: 11,
    }}>
      <span style={{
        color: "var(--text)", width: 90,
        fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
      }}>
        {label}
      </span>
      <span style={{ color, width: 84, textAlign: "right", fontWeight: 700 }}>
        {state.density.toFixed(2)}<span style={{ fontSize: 9, opacity: 0.8 }}>/m²</span>
      </span>
      <span style={{ color: "var(--text-mute)", width: 48, textAlign: "right" }}>
        {state.count}
      </span>
      <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
        {history.length >= 2 ? (
          <svg width={W} height={H} style={{ overflow: "visible" }}>
            <polyline points={pts} fill="none" stroke={color} strokeWidth={1.4} opacity={0.85} />
            {history.length > 0 && (
              <circle cx={W} cy={H - (history[history.length - 1] / max) * H} r={2} fill={color} />
            )}
          </svg>
        ) : (
          <span style={{ color: "var(--text-faint)", fontSize: 9 }}>——</span>
        )}
      </div>
      <div style={{ width: 54, display: "flex", justifyContent: "flex-end" }}>
        <span style={{
          color, background: sMeta.bg,
          border: `1px solid ${color}40`,
          borderRadius: 3, padding: "1px 5px",
          fontSize: 8.5, fontWeight: 700, letterSpacing: "0.06em",
        }}>
          {sMeta.label}
        </span>
      </div>
    </div>
  );
}
