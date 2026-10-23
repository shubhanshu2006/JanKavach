"use client";
import { useStationConfig } from "@/lib/config-context";

export default function CategoriesTab() {
  const { config } = useStationConfig();
  return (
    <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
      {config?.categories.map((c) => (
        <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
          <span style={{ width: 10, height: 10, background: c.color, display: "inline-block" }} />
          {c.label}
        </div>
      ))}
    </div>
  );
}
