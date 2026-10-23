"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import type { LiveUpdate } from "./types";
import { WS_URL } from "./constants";

export function useLiveData() {
  const [data, setData] = useState<LiveUpdate | null>(null);
  const [connected, setConnected] = useState(false);
  const ws = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return;

    const socket = new WebSocket(WS_URL);
    ws.current = socket;

    socket.onopen = () => setConnected(true);

    socket.onmessage = (e) => {
      try {
        setData(JSON.parse(e.data) as LiveUpdate);
      } catch {}
    };

    socket.onclose = () => {
      setConnected(false);
      retryRef.current = setTimeout(connect, 2000);
    };

    socket.onerror = () => socket.close();
  }, []);

  useEffect(() => {
    connect();
    return () => {
      ws.current?.close();
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, [connect]);

  return { data, connected };
}
