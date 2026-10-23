"use client";
import { useStationConfig } from "@/lib/config-context";

export default function ViewsTab() {
  const { config } = useStationConfig();
  return <div style={{ fontSize: 12, color: "var(--text-dim)" }}>{config ? "Views loaded." : "Loading…"}</div>;
}
