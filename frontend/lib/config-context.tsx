"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { API_URL } from "./constants";
import type { StationConfig } from "./types";

interface ConfigContextValue {
  config: StationConfig | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const ConfigContext = createContext<ConfigContextValue | null>(null);

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<StationConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const res = await fetch(`${API_URL}/config`);
    const data: StationConfig = await res.json();
    setConfig(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <ConfigContext.Provider value={{ config, loading, refresh }}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useStationConfig(): ConfigContextValue {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error("useStationConfig must be used within a ConfigProvider");
  return ctx;
}
