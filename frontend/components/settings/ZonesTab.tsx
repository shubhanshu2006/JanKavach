"use client";
import { useStationConfig } from "@/lib/config-context";

export default function ZonesTab() {
  const { config } = useStationConfig();
  return (
    <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
      {config?.zones.map((z) => (
        <div key={z.id} style={{ padding: "4px 0" }}>{z.label} ({z.short_label})</div>
      ))}
    </div>
  );
}
