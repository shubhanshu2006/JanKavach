"use client";
import type { ZoneState } from "@/lib/types";
import { BORDER_MAP } from "@/lib/constants";
import { useStationConfig } from "@/lib/config-context";

interface Props {
  zones: Record<string, ZoneState>;
  historyMap: Record<string, number[]>;
}

const TRACKED = ["CONC", "FOB1", "FOB2", "P1", "P2", "P3", "P4"];
const STATUS_LABEL: Record<string, string> = {
  green: "CLR", amber: "CAU", red: "DGR", critical: "CRT",
};

export default function ZoneChart({ zones, historyMap }: Props) {
  const { config } = useStationConfig();
  return (
    <div>
      <div className="scope" style={{
        display: "flex", alignItems: "center",
        padding: "4px 12px",
        fontSize: 9, color: "var(--text-faint)", letterSpacing: "0.1em",
        borderBottom: "1px solid var(--hair-dim)",
      }}>
        <span style={{ width: 56 }}>ZONE</span>
        <span style={{ width: 72, textAlign: "right" }}>DENSITY</span>
        <span style={{ width: 38, textAlign: "right" }}>PRS</span>
        <span style={{ flex: 1, textAlign: "center" }}>TREND</span>
        <span style={{ width: 28, textAlign: "right" }}>STS</span>
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
  const color  = BORDER_MAP[state.color];
  const status = STATUS_LABEL[state.color] ?? "---";
  const isCrit = state.color === "critical";

  const W = 76, H = 14;
  const max = Math.max(...history, 1);
  const pts = history.slice(-20).map((v, i, arr) => {
    const x = (i / Math.max(arr.length - 1, 1)) * W;
    const y = H - (v / max) * H;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  return (
    <div className="scope" style={{
      display: "flex", alignItems: "center",
      padding: "5px 12px",
      borderBottom: "1px solid var(--hair-dim)",
      background: isCrit ? "rgba(255,26,26,0.06)" : "transparent",
      fontSize: 11,
    }}>
      <span style={{ color, width: 56, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {label}
      </span>
      <span style={{ color, width: 72, textAlign: "right", fontWeight: 700 }}>
        {state.density.toFixed(2)}/m²
      </span>
      <span style={{ color: "var(--text-mute)", width: 38, textAlign: "right" }}>
        {state.count}
      </span>
      <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
        {history.length >= 2 ? (
          <svg width={W} height={H} style={{ overflow: "visible" }}>
            <polyline points={pts} fill="none" stroke={color} strokeWidth={1.2} opacity={0.75} />
            {history.length > 0 && (
              <circle cx={W} cy={H - (history[history.length - 1] / max) * H} r={1.5} fill={color} />
            )}
          </svg>
        ) : (
          <span style={{ color: "var(--text-faint)" }}>——</span>
        )}
      </div>
      <span style={{ color, width: 28, textAlign: "right", letterSpacing: "0.05em" }}>
        {status}
      </span>
    </div>
  );
}
