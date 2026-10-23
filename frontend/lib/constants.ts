export const COLOR_MAP: Record<string, string> = {
  green:    "rgba(41,255,140,0.08)",
  amber:    "rgba(255,176,32,0.12)",
  red:      "rgba(255,59,59,0.18)",
  critical: "rgba(255,26,26,0.32)",
};

export const BORDER_MAP: Record<string, string> = {
  green:    "#29FF8C",
  amber:    "#FFB020",
  red:      "#FF3B3B",
  critical: "#FF1A1A",
};

export const TEXT_MAP: Record<string, string> = {
  green:    "text-green-400",
  amber:    "text-amber-400",
  red:      "text-red-400",
  critical: "text-red-500",
};

export const LEVEL_COLORS: Record<number, string> = {
  1: "#29FF8C",
  2: "#FFB020",
  3: "#FF3B3B",
  4: "#FF7A1A",  // PRE_WARN — deep orange
  5: "#FF1A1A",  // SOS — full emergency red
};

export const WS_URL  = process.env.NEXT_PUBLIC_WS_URL  ?? "ws://localhost:8000/ws/live";
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
