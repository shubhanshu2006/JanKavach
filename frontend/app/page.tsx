"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Video, Wifi, WifiOff, RefreshCw, Settings, ShieldCheck, ChevronDown, ChevronUp } from "lucide-react";
import { useLiveData } from "@/lib/websocket";
import { API_URL, BORDER_MAP } from "@/lib/constants";
import { useStationConfig } from "@/lib/config-context";
import StationMap from "@/components/StationMap";
import SettingsPanel from "@/components/SettingsPanel";
import AuditDossierModal from "@/components/AuditDossierModal";
import VideoSourcePicker, { VideoSource } from "@/components/VideoSourcePicker";
import InterventionFeed from "@/components/InterventionFeed";
import ThresholdConfirmCard from "@/components/ThresholdConfirmCard";
import ZoneChart from "@/components/ZoneChart";
import SplitScreen from "@/components/SplitScreen";
import PAAnnouncementBanner from "@/components/PAAnnouncementBanner";
import PhoneNotification from "@/components/PhoneNotification";
import RPFAlert from "@/components/RPFAlert";
import VideoPlayer from "@/components/VideoPlayer";
import VideoTrackingView from "@/components/VideoTrackingView";
import EmergencyOverlay from "@/components/EmergencyOverlay";
import PreWarnBanner from "@/components/PreWarnBanner";
import type { GateState, Intervention } from "@/lib/types";

type View = "dashboard" | "split";

const SYSTEM_STATUS_META: Record<string, { color: string; label: string }> = {
  normal:     { color: "#29FF8C", label: "NORMAL" },
  monitoring: { color: "#16A35C", label: "MONITORING" },
  active:     { color: "#FFB020", label: "ACTIVE" },
  critical:   { color: "#FF3B3B", label: "CRITICAL" },
};

const DEMO_LEVELS = [
  { level: 1, label: "L1",   color: "#29FF8C" },
  { level: 2, label: "L2",   color: "#FFB020" },
  { level: 3, label: "L3",   color: "#FF3B3B" },
  { level: 4, label: "PRE",  color: "#FF7A1A" },
  { level: 5, label: "SOS",  color: "#FF1A1A" },
];

export default function Home() {
  const { config } = useStationConfig();
  const { data, connected } = useLiveData();
  const [view, setView]       = useState<View>("dashboard");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [historyMap, setHistoryMap] = useState<Record<string, number[]>>({});
  const [clock, setClock]     = useState("");
  const [liveMode, setLiveMode] = useState<"scenario" | "video">("scenario");
  const [videoSource, setVideoSource] = useState<VideoSource | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Derived from the backend's own demo_running flag, not local optimistic state —
  // the scenario clock is a global, server-side singleton (any tab, any earlier
  // click can have started it), so a freshly-mounted tab has to ask the backend
  // what's actually running rather than assuming "nobody's pressed start yet".
  const demoStarted = !!data?.demo_running;
  const [videoLoading, setVideoLoading] = useState(false);
  const lastDataTime = useRef<number>(Date.now());

  const [paMessage, setPaMessage]   = useState<{ message: string; zone: string } | null>(null);
  const [phoneNotif, setPhoneNotif] = useState<{ title: string; body: string; level: string } | null>(null);
  const [activeSos, setActiveSos]   = useState<Intervention | null>(null);
  const [demoMaxLevel, setDemoMaxLevel] = useState(5);

  // Draggable Zone Density Matrix height & collapse state
  const [matrixHeight, setMatrixHeight] = useState<number>(170);
  const [isDraggingMatrix, setIsDraggingMatrix] = useState<boolean>(false);
  const lastExpandedHeightRef = useRef<number>(180);
  const dragStartYRef = useRef<number>(0);
  const dragStartHeightRef = useRef<number>(180);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    setIsDraggingMatrix(true);
    dragStartYRef.current = e.clientY;
    dragStartHeightRef.current = matrixHeight;
  }, [matrixHeight]);

  useEffect(() => {
    if (!isDraggingMatrix) return;

    const handlePointerMove = (e: PointerEvent) => {
      const deltaY = e.clientY - dragStartYRef.current;
      const newH = Math.max(34, Math.min(420, dragStartHeightRef.current - deltaY));
      setMatrixHeight(newH);
      if (newH > 45) {
        lastExpandedHeightRef.current = newH;
      }
    };

    const handlePointerUp = () => {
      setIsDraggingMatrix(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isDraggingMatrix]);

  const toggleMatrixCollapse = useCallback(() => {
    if (matrixHeight <= 40) {
      setMatrixHeight(lastExpandedHeightRef.current || 180);
    } else {
      lastExpandedHeightRef.current = matrixHeight;
      setMatrixHeight(34);
    }
  }, [matrixHeight]);

  const paShownIds    = useRef<Set<string>>(new Set());
  const phoneShownIds = useRef<Set<string>>(new Set());
  const sosShownIds   = useRef<Set<string>>(new Set());
  // The intervention list is server-side history that outlives any one page
  // load — it can already contain a fired SOS (or L1/RPF/L3) from before this
  // tab connected, whether from an earlier run or just a refresh mid-incident.
  // Without this, a refresh re-derives "is there a fired SOS" from that stale
  // history with fresh (empty) local dismissed-state and pops the emergency
  // overlay right back up. Seed the shown-id sets from whatever already exists
  // in the very first payload this tab receives, so only interventions that
  // fire AFTER that point count as new.
  const baselineSeeded = useRef(false);
  useEffect(() => {
    if (baselineSeeded.current) return;
    const ivs = data?.interventions;
    if (!ivs) return;
    baselineSeeded.current = true;
    for (const iv of ivs) {
      if (iv.level === 1) paShownIds.current.add(iv.id);
      if ((iv.level === 2 && iv.action.toLowerCase().includes("rpf")) || iv.level === 3) {
        phoneShownIds.current.add(iv.id);
      }
      if (iv.level === 5 && iv.status === "fired") sosShownIds.current.add(iv.id);
    }
  }, [data?.interventions]);

  useEffect(() => {
    if (!data?.crowdguard?.zones) return;
    setHistoryMap(prev => {
      const next = { ...prev };
      for (const [zid, state] of Object.entries(data.crowdguard.zones)) {
        const arr = next[zid] ?? [];
        next[zid] = [...arr, state.density].slice(-30);
      }
      return next;
    });
  }, [data]);

  useEffect(() => {
    const ivs = data?.interventions;
    if (!ivs) return;
    for (const iv of ivs) {
      if (iv.level !== 1) continue;
      if (paShownIds.current.has(iv.id)) continue;
      const colonIdx = iv.action.indexOf(': "');
      const msg = colonIdx >= 0 ? iv.action.slice(colonIdx + 3).replace(/"$/, "") : iv.action;
      setPaMessage({ message: msg, zone: iv.zone });
      paShownIds.current.add(iv.id);
      break;
    }
  }, [data?.interventions]);

  useEffect(() => {
    const ivs = data?.interventions;
    if (!ivs) return;
    for (const iv of ivs) {
      const isRpf = iv.level === 2 && iv.action.toLowerCase().includes("rpf");
      const isL3  = iv.level === 3;
      if (!isRpf && !isL3) continue;
      if (phoneShownIds.current.has(iv.id)) continue;
      setPhoneNotif({
        title: isL3 ? "CRITICAL — Confirm Required" : "RPF Dispatch Requested",
        body: isL3
          ? `${iv.zone}: ${iv.action.split(".")[0]}`
          : `Booth-3 notified for ${iv.zone}. ${iv.action.split(".")[0]}`,
        level: `L${iv.level}`,
      });
      phoneShownIds.current.add(iv.id);
      break;
    }
  }, [data?.interventions]);

  useEffect(() => {
    const ivs = data?.interventions;
    if (!ivs) return;
    const sos = ivs.find(iv => iv.level === 5 && iv.status === "fired" && !sosShownIds.current.has(iv.id));
    if (sos) {
      sosShownIds.current.add(sos.id);
      setActiveSos(sos);
    }
  }, [data?.interventions]);

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString("en-IN", { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Track data freshness: when video mode and data stops for >2s, show loading
  useEffect(() => {
    if (data) {
      lastDataTime.current = Date.now();
      if (videoLoading && data.video_ready) setVideoLoading(false);
    }
  }, [data, videoLoading]);

  useEffect(() => {
    if (liveMode === "scenario") return;
    const id = setInterval(() => {
      if (Date.now() - lastDataTime.current > 2000) setVideoLoading(true);
    }, 500);
    return () => clearInterval(id);
  }, [liveMode]);

  // Force back to dashboard view when switching away from scenario (no comparison tab in video mode)
  useEffect(() => {
    if (liveMode !== "scenario") setView("dashboard");
  }, [liveMode]);

  // Select demo mode — shows the START overlay unless the backend already has
  // a scenario run in progress, in which case that's what should be visible.
  const selectDemo = () => {
    setLiveMode("scenario");
    setVideoLoading(false);
  };

  const _clearVisualState = () => {
    setActiveSos(null);
    setPaMessage(null);
    setPhoneNotif(null);
    paShownIds.current.clear();
    phoneShownIds.current.clear();
    sosShownIds.current.clear();
  };

  // Actually fire the demo scenario
  const launchDemo = (level = demoMaxLevel) =>
    fetch(`${API_URL}/demo/start?max_level=${level}`, { method: "POST" })
      .then(() => { _clearVisualState(); })
      .catch(() => {});

  const setLevel = (level: number) => {
    setDemoMaxLevel(level);
    _clearVisualState();
    if (demoStarted) {
      fetch(`${API_URL}/demo/set_level/${level}`, { method: "POST" }).catch(() => {});
    }
  };

  // Full stop — clears the contact log and scenario clock and drops back to
  // the "START DEMO" screen, rather than set_level's immediate restart.
  const resetDemo = () =>
    fetch(`${API_URL}/demo/reset`, { method: "POST" })
      .then(() => { _clearVisualState(); setHistoryMap({}); })
      .catch(() => {});

  const startLive = (source: VideoSource) =>
    fetch(`${API_URL}/live/start?source=${encodeURIComponent(source.key)}`, { method: "POST" })
      .then(() => {
        setVideoSource(source);
        setLiveMode("video");
        setVideoLoading(true);
        lastDataTime.current = Date.now();
        paShownIds.current.clear();
        phoneShownIds.current.clear();
        sosShownIds.current.clear();
        setActiveSos(null);
      })
      .catch(() => {});

  const confirm = (id: string) =>
    fetch(`${API_URL}/intervention/${id}/confirm`, { method: "POST" }).catch(() => {});
  const cancel  = (id: string) =>
    fetch(`${API_URL}/intervention/${id}/cancel`,  { method: "POST" }).catch(() => {});
  // Bulk actions for the unified ThresholdConfirmCard — one button resolves
  // every zone that tripped the same threshold together, instead of forcing
  // an operator to click through a separate confirm per zone.
  const confirmAll = (ids: string[]) => ids.forEach(confirm);
  const cancelAll  = (ids: string[]) => ids.forEach(cancel);

  const dismissPA    = useCallback(() => setPaMessage(null),  []);
  const dismissPhone = useCallback(() => setPhoneNotif(null), []);

  const zones            = data?.crowdguard?.zones ?? {};
  const status           = data?.system_status ?? "normal";
  const allInterventions: Intervention[] = data?.interventions ?? [];
  const elapsed           = data?.elapsed ?? 0;
  const sc                = SYSTEM_STATUS_META[status];
  const shortLabel = (zoneId: string) => config?.zones.find((z) => z.id === zoneId)?.short_label ?? zoneId;

  // Grouped by level so simultaneous trips (e.g. 3 platforms all crossing L3
  // together) collapse into one confirm/cancel decision instead of one per zone.
  const stagedItems = data?.staged ?? [];
  const stagedL2 = stagedItems.filter((iv) => iv.level === 2);
  const stagedL3 = stagedItems.filter((iv) => iv.level === 3);

  const gateStates: Record<string, GateState> = { GATE_A: "open", GATE_B: "open", GATE_C: "open" };
  for (const iv of allInterventions) {
    if (iv.status === "cancelled") continue;
    if (iv.level === 3 && iv.status === "confirmed") {
      if (iv.zone === "FOB1") gateStates["GATE_B"] = "closed";
      if (iv.zone === "CONC") { gateStates["GATE_A"] = gateStates["GATE_B"] = gateStates["GATE_C"] = "closed"; }
    } else if (iv.level === 2 && (iv.status === "staged" || iv.status === "confirmed")) {
      if (iv.zone === "FOB1" && gateStates["GATE_B"] === "open") gateStates["GATE_B"] = "restricted";
      if (iv.zone === "FOB2" && gateStates["GATE_A"] === "open") gateStates["GATE_A"] = "restricted";
      if (iv.zone === "GATE_B" && gateStates["GATE_B"] === "open") gateStates["GATE_B"] = "restricted";
    }
  }
  const esc1Reversed = allInterventions.some(iv => iv.level === 2 && iv.zone === "P3" && iv.status !== "cancelled");
  const esc2Reversed = allInterventions.some(iv => iv.level === 2 && iv.zone === "P4" && iv.status !== "cancelled");
  const rpfActive    = allInterventions.some(iv => iv.level === 2 && iv.zone === "CONC" && iv.status !== "cancelled");
  const hasCritical  = Object.values(zones).some(z => z.color === "critical");

  const preWarnIv  = allInterventions.find(iv => iv.level === 4 && iv.status === "fired");
  // Once any SOS has ever fired this session, the PRE-WARN banner (a lesser,
  // ongoing "standby" status) stops applying — checked by existence, not by
  // whether the overlay is currently being shown, so it stays suppressed even
  // after the SOS overlay has been dismissed/auto-dismissed.
  const anySosFired    = allInterventions.some(iv => iv.level === 5 && iv.status === "fired");
  const preWarnActive  = !!preWarnIv && !anySosFired;
  const sosActive      = activeSos !== null;

  return (
    <>
      {/* Below the desktop breakpoint the console locks rather than rendering a
          squeezed, unreadable scope — see .desktop-lock in globals.css. */}
      <div className="desktop-lock scope" style={{
        position: "fixed", inset: 0, background: "var(--bg)", zIndex: 200,
        flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 24,
      }}>
        <SentinelMark />
        <div style={{ fontSize: 13, color: "var(--text)", letterSpacing: "0.14em" }}>JANKAVACH</div>
        <div style={{ fontSize: 11, color: "var(--text-dim)", letterSpacing: "0.06em", textAlign: "center", maxWidth: 280, lineHeight: 1.6 }}>
          This console is instrumentation for a control-room display — open it on a desktop or laptop-class screen (≥1024px).
        </div>
      </div>

    <div className="app-shell h-screen w-screen flex flex-col overflow-hidden" style={{ background: "var(--bg)" }}>

      {/* ── Header ── */}
      <header className="scope" style={{
        background: "var(--panel-2)",
        borderBottom: "1px solid var(--hair)",
        height: 44,
        display: "flex", alignItems: "center",
        padding: "0 12px", gap: 12, flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <SentinelMark />
          <span style={{ fontSize: 13, color: "var(--text)", letterSpacing: "0.14em" }}>JANKAVACH</span>
          <span style={{ fontSize: 10, color: "var(--text-faint)" }}>v2.0</span>
        </div>

        <div className="station-ident" style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <Divider />
          <span style={{ fontSize: 11, color: "var(--text-dim)", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>
            NDT-CENTRAL / NEW DELHI TERMINAL
          </span>
        </div>

        {/* View tabs — COMPARISON only in scenario mode */}
        <div style={{ display: "flex", gap: 3, marginLeft: 6 }}>
          {(["dashboard", ...(liveMode === "scenario" ? ["split"] : [])] as View[]).map(v => (
            <button key={v} className="btn-seg" onClick={() => setView(v)} style={{
              height: 26, padding: "0 10px", fontSize: 10,
              background: view === v ? "var(--hair)" : "transparent",
              color: view === v ? "var(--text)" : "var(--text-faint)",
              border: `1px solid ${view === v ? "var(--hair)" : "transparent"}`,
              letterSpacing: "0.1em",
            }}>
              {v === "dashboard" ? "TRACK VIEW" : "COMPARISON"}
            </button>
          ))}
        </div>

        {/* Demo level toggle — only in scenario mode */}
        {liveMode === "scenario" && (
          <>
            <Divider />
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 9, color: "var(--text-faint)", letterSpacing: "0.1em" }}>MAX LEVEL</span>
              {DEMO_LEVELS.map(({ level, label, color }) => {
                const sel = demoMaxLevel === level;
                return (
                  <button key={level} className="btn-seg" onClick={() => setLevel(level)} style={{
                    height: 22, padding: "0 7px", fontSize: 9,
                    background: sel ? color : "transparent",
                    color: sel ? "#04120B" : "var(--text-faint)",
                    border: `1px solid ${sel ? color : "var(--hair)"}`,
                    letterSpacing: "0.06em",
                    fontWeight: sel ? 700 : 400,
                  }}>
                    {label}
                  </button>
                );
              })}
            </div>

            <button className="btn-seg" onClick={resetDemo}
              title="Reset demo — clears the contact log and returns to the start screen"
              style={{
                display: "flex", alignItems: "center", gap: 5,
                height: 22, padding: "0 8px", fontSize: 9,
                background: "transparent", color: "var(--text-faint)",
                border: "1px solid var(--hair)", letterSpacing: "0.06em",
              }}>
              <RefreshCw size={10} strokeWidth={1.75} /> RESET
            </button>
          </>
        )}

        <div style={{ flex: 1 }} />

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <motion.div
            style={{ width: 7, height: 7, borderRadius: "50%", background: sc.color }}
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
          <span style={{ fontSize: 11, color: sc.color, letterSpacing: "0.1em" }}>{sc.label}</span>
        </div>

        <Divider />

        <span style={{ fontSize: 11, color: "var(--text-faint)" }}>
          T+<span style={{ color: "var(--text-mute)" }}>{Math.floor(elapsed)}s</span>
        </span>

        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: connected ? "var(--sweep)" : "var(--red)" }}>
          {connected ? <Wifi size={12} strokeWidth={1.75} /> : <WifiOff size={12} strokeWidth={1.75} />}
          {connected ? "CONN" : "DISC"}
        </span>

        <span style={{ fontSize: 12, color: "var(--text-dim)", minWidth: 58, textAlign: "right" }}>
          {clock}
        </span>

        <Divider />

        {/* Mode buttons */}
        <div style={{ display: "flex", gap: 4 }}>
          <button className="btn-seg" onClick={selectDemo} style={{
            display: "flex", alignItems: "center", gap: 6,
            height: 28, padding: "0 10px", fontSize: 10,
            background: liveMode === "scenario" ? "#29FF8C18" : "transparent",
            color: liveMode === "scenario" ? "#29FF8C" : "var(--text-faint)",
            border: `1px solid ${liveMode === "scenario" ? "#29FF8C" : "var(--hair)"}`,
            letterSpacing: "0.08em",
          }}>
            <Play size={11} strokeWidth={1.75} /> DEMO
          </button>
          <button className="btn-seg" onClick={() => setPickerOpen(true)} style={{
            display: "flex", alignItems: "center", gap: 6,
            height: 28, padding: "0 10px", fontSize: 10,
            background: liveMode === "video" ? "#FFB02018" : "transparent",
            color: liveMode === "video" ? "#FFB020" : "var(--text-faint)",
            border: `1px solid ${liveMode === "video" ? "#FFB020" : "var(--hair)"}`,
            letterSpacing: "0.08em",
          }}>
            <Video size={11} strokeWidth={1.75} /> {liveMode === "video" && videoSource ? videoSource.label : "VIEW"}
          </button>
        </div>

        <Divider />

        <button
          onClick={() => setAuditOpen(true)}
          title="CRS Statutory Audit & Black-Box Dossier"
          style={{
            display: "flex", alignItems: "center", gap: 5,
            height: 26, padding: "0 8px", fontSize: 10,
            background: "rgba(16, 185, 129, 0.12)",
            color: "#34D399",
            border: "1px solid rgba(16, 185, 129, 0.35)",
            borderRadius: 4,
            cursor: "pointer",
            fontWeight: 600,
            letterSpacing: "0.08em",
          }}
        >
          <ShieldCheck size={12} strokeWidth={2} /> CRS AUDIT
        </button>

        <button onClick={() => setSettingsOpen(true)} title="Station configuration" style={{ background: "none", border: "none", cursor: "pointer" }}>
          <Settings size={16} color="var(--text-dim)" />
        </button>
      </header>

      {/* ── Body ── */}
      <main style={{ flex: 1, minHeight: 0, padding: 6, display: "flex" }}>
        <AnimatePresence mode="wait">
          {view === "dashboard" ? (
            <motion.div key="dashboard"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ flex: 1, minHeight: 0, height: "100%", display: "grid", gridTemplateColumns: "minmax(0, 1fr) 370px", gap: 6 }}>

              {/* Left column */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6, minHeight: 0 }}>

                {liveMode === "scenario" ? (
                  <>
                    {/* Approach scope */}
                    <div className="panel" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", position: "relative" }}>
                      <div className="panel-title" style={{ display: "flex", alignItems: "center" }}>
                        <span>NEW DELHI RAILWAY STATION — NDLS · FEB 15 2025</span>
                        <span style={{ marginLeft: 10, color: "var(--text-faint)" }}>SCENARIO REPLAY</span>
                        {data?.crowdguard?.predictions && (
                          <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4, color: "var(--text-faint)" }}>
                            <RefreshCw size={9} strokeWidth={1.75} /> +90s FORECAST
                          </span>
                        )}
                      </div>
                      <div style={{
                        flex: 1, minHeight: 0, padding: "2px 6px",
                        overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
                        position: "relative"
                      }}>
                        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 0 }}>
                          <StationMap
                            zones={zones}
                            predictions={data?.crowdguard?.predictions}
                            showPredictions
                            gateStates={gateStates}
                            esc1Reversed={esc1Reversed}
                            esc2Reversed={esc2Reversed}
                            systemStatus={status}
                          />
                        </div>

                        {/* Docked CCTV widget INSIDE the scope panel — never overlaps the Zone Matrix! */}
                        {liveMode === "scenario" && (
                          <VideoPlayer
                            critical={hasCritical}
                            videoSrc="/videos/platform.webm"
                            persons={[]}
                            showTracking={false}
                          />
                        )}
                      </div>

                      {/* Demo: not yet started overlay */}
                      <AnimatePresence>
                        {!demoStarted && (
                          <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            style={{
                              position: "absolute", inset: 0,
                              background: "rgba(4,7,10,0.88)",
                              display: "flex", flexDirection: "column",
                              alignItems: "center", justifyContent: "center", gap: 12,
                              zIndex: 5,
                            }}
                          >
                            <div className="scope" style={{ fontSize: 10, color: "var(--text-faint)", letterSpacing: "0.12em" }}>
                              SCENARIO MODE — READY
                            </div>
                            <div style={{ display: "flex", gap: 5 }}>
                              {DEMO_LEVELS.map(({ level, label, color }) => (
                                <div key={level} className="scope" style={{
                                  fontSize: 9, padding: "3px 8px",
                                  color: demoMaxLevel >= level ? color : "var(--text-faint)",
                                  border: `1px solid ${demoMaxLevel >= level ? color : "var(--hair)"}`,
                                  background: demoMaxLevel >= level ? `${color}12` : "transparent",
                                }}>
                                  {label}
                                </div>
                              ))}
                            </div>
                            <button
                              className="btn-seg scope"
                              onClick={() => launchDemo()}
                              style={{
                                display: "flex", alignItems: "center", gap: 8,
                                padding: "10px 28px", fontSize: 13,
                                background: "rgba(41,255,140,0.12)",
                                color: "var(--sweep)",
                                border: "1px solid var(--sweep)",
                                letterSpacing: "0.14em",
                              }}
                            >
                              <Play size={14} strokeWidth={1.75} /> START DEMO
                            </button>
                            <div className="scope" style={{ fontSize: 9, color: "var(--text-faint)", letterSpacing: "0.08em" }}>
                              NEW DELHI TERMINAL — INCIDENT RECREATION 2025
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Resizable Divider Handle between Radar and Zone Matrix */}
                    <div
                      className={`radar-divider-handle ${isDraggingMatrix ? "dragging" : ""}`}
                      onPointerDown={handlePointerDown}
                      onDoubleClick={toggleMatrixCollapse}
                      title="Drag up/down to resize radar vs zone matrix • Double-click to collapse/expand"
                      style={{
                        height: 10,
                        margin: "1px 0",
                        cursor: "ns-resize",
                        userSelect: "none",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        position: "relative",
                        zIndex: 10,
                      }}
                    >
                      <div style={{
                        width: 52,
                        height: 4,
                        borderRadius: 2,
                        background: isDraggingMatrix ? "var(--sweep)" : "var(--hair)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 3,
                        transition: "all 0.15s ease",
                      }}>
                        <span style={{ width: 2, height: 2, borderRadius: 1, background: isDraggingMatrix ? "#04070A" : "var(--text-faint)" }} />
                        <span style={{ width: 2, height: 2, borderRadius: 1, background: isDraggingMatrix ? "#04070A" : "var(--text-faint)" }} />
                        <span style={{ width: 2, height: 2, borderRadius: 1, background: isDraggingMatrix ? "#04070A" : "var(--text-faint)" }} />
                      </div>
                    </div>

                    {/* Zone density chart - resizable/collapsible card */}
                    <div
                      className="panel"
                      style={{
                        height: matrixHeight,
                        minHeight: matrixHeight,
                        maxHeight: matrixHeight,
                        flexShrink: 0,
                        overflow: "hidden",
                        display: "flex",
                        flexDirection: "column",
                        transition: isDraggingMatrix ? "none" : "height 0.18s cubic-bezier(0.16, 1, 0.3, 1)",
                      }}
                    >
                      <div
                        className="panel-title"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "5px 12px",
                          cursor: "pointer",
                          userSelect: "none",
                        }}
                        onClick={toggleMatrixCollapse}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span>ZONE DENSITY MATRIX — 30s ROLLING</span>
                          {matrixHeight <= 40 && (
                            <span style={{
                              fontSize: 9,
                              color: "var(--sweep)",
                              background: "rgba(41,255,140,0.12)",
                              border: "1px solid rgba(41,255,140,0.3)",
                              padding: "1px 6px",
                              borderRadius: 3,
                              letterSpacing: "0.08em"
                            }}>
                              COLLAPSED · RADAR MAXIMIZED
                            </span>
                          )}
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 5 }} onClick={(e) => e.stopPropagation()}>
                          <button
                            className="btn-seg scope"
                            onClick={() => {
                              if (matrixHeight > 40) lastExpandedHeightRef.current = matrixHeight;
                              setMatrixHeight(34);
                            }}
                            title="Collapse (Maximum Radar space)"
                            style={{
                              fontSize: 9, padding: "2px 6px",
                              background: matrixHeight <= 40 ? "rgba(41,255,140,0.2)" : "transparent",
                              color: matrixHeight <= 40 ? "var(--sweep)" : "var(--text-faint)",
                              border: `1px solid ${matrixHeight <= 40 ? "var(--sweep)" : "var(--hair)"}`,
                            }}
                          >
                            MIN
                          </button>
                          <button
                            className="btn-seg scope"
                            onClick={() => setMatrixHeight(135)}
                            title="Compact view (135px)"
                            style={{
                              fontSize: 9, padding: "2px 6px",
                              background: matrixHeight > 40 && matrixHeight < 200 ? "rgba(41,255,140,0.2)" : "transparent",
                              color: matrixHeight > 40 && matrixHeight < 200 ? "var(--sweep)" : "var(--text-faint)",
                              border: `1px solid ${matrixHeight > 40 && matrixHeight < 200 ? "var(--sweep)" : "var(--hair)"}`,
                            }}
                          >
                            MID
                          </button>
                          <button
                            className="btn-seg scope"
                            onClick={() => setMatrixHeight(260)}
                            title="Full view (260px)"
                            style={{
                              fontSize: 9, padding: "2px 6px",
                              background: matrixHeight >= 200 ? "rgba(41,255,140,0.2)" : "transparent",
                              color: matrixHeight >= 200 ? "var(--sweep)" : "var(--text-faint)",
                              border: `1px solid ${matrixHeight >= 200 ? "var(--sweep)" : "var(--hair)"}`,
                            }}
                          >
                            FULL
                          </button>
                          <button
                            className="btn-seg"
                            onClick={toggleMatrixCollapse}
                            title={matrixHeight <= 40 ? "Expand" : "Collapse"}
                            style={{
                              background: "transparent", border: "none", color: "var(--text-dim)",
                              display: "flex", alignItems: "center", cursor: "pointer", padding: "1px 3px"
                            }}
                          >
                            {matrixHeight <= 40 ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          </button>
                        </div>
                      </div>

                      {matrixHeight > 40 && (
                        <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }} className="scrollbar-thin">
                          <ZoneChart zones={zones} historyMap={historyMap} />
                        </div>
                      )}
                    </div>

                  </>
                ) : (
                  /* Video mode: full tracking split view */
                  <div className="panel" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                    <VideoTrackingView
                      videoSrc={videoSource ? `${API_URL}${videoSource.url}` : ""}
                      persons={data?.persons ?? []}
                      zones={zones}
                      loading={videoLoading}
                      source={videoSource?.label ?? ""}
                    />
                  </div>
                )}
              </div>

              {/* Right column: Action & Telemetry Panel */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6, minHeight: 0 }}>

                {/* Staged Alert Actions (L3 / L2) - In-flow, NEVER overlapping the Contact Log! */}
                <AnimatePresence>
                  {(stagedL3.length > 0 || stagedL2.length > 0) && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}
                    >
                      {stagedL3.length > 0 && (
                        <ThresholdConfirmCard
                          level={3}
                          items={stagedL3}
                          shortLabel={shortLabel}
                          onConfirmAll={confirmAll}
                          onCancelAll={cancelAll}
                        />
                      )}
                      {stagedL2.length > 0 && (
                        <ThresholdConfirmCard
                          level={2}
                          items={stagedL2}
                          shortLabel={shortLabel}
                          onConfirmAll={confirmAll}
                          onCancelAll={cancelAll}
                        />
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Contact Log - Automatically flexes and scrolls */}
                <div className="panel" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                  <InterventionFeed interventions={allInterventions} />
                </div>

                {/* Density Forecast - Pinned neatly at bottom */}
                {data?.crowdguard?.predictions && (
                  <div className="panel" style={{ flexShrink: 0, overflow: "hidden" }}>
                    <div className="panel-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span>DENSITY FORECAST</span>
                      <span style={{ fontSize: 9, color: "var(--text-faint)", letterSpacing: "0.08em" }}>T+30 / 60 / 90s</span>
                    </div>
                    <div style={{ padding: "3px 0" }}>
                      <div className="scope" style={{
                        display: "flex", alignItems: "center",
                        padding: "3px 12px", fontSize: 9, color: "var(--text-faint)",
                        borderBottom: "1px solid var(--hair-dim)", letterSpacing: "0.08em"
                      }}>
                        <span style={{ width: 68 }}>ZONE</span>
                        <span style={{ flex: 1, textAlign: "right" }}>+30s</span>
                        <span style={{ flex: 1, textAlign: "right" }}>+60s</span>
                        <span style={{ flex: 1, textAlign: "right" }}>+90s</span>
                      </div>
                      {["FOB1", "P3", "GATE_B"].map(z => {
                        const pred = data.crowdguard.predictions[z];
                        if (!pred) return null;
                        return (
                          <div key={z} className="scope" style={{
                            display: "flex", alignItems: "center",
                            padding: "5px 12px", borderBottom: "1px solid var(--hair-dim)",
                            fontSize: 10.5,
                          }}>
                            <span style={{ color: "var(--text)", width: 68, fontWeight: 600 }}>
                              {config?.zones.find((zc) => zc.id === z)?.short_label}
                            </span>
                            {[pred.t30, pred.t60, pred.t90].map((p, i) => (
                              <span key={i} style={{ color: BORDER_MAP[p.color], flex: 1, textAlign: "right", fontWeight: 700 }}>
                                {p.density.toFixed(1)}/m²
                              </span>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div key="split"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ flex: 1, minHeight: 0, height: "100%" }}>
              <SplitScreen data={data} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <PAAnnouncementBanner message={paMessage?.message ?? null} zone={paMessage?.zone ?? ""} onDismiss={dismissPA} />
      <PreWarnBanner active={preWarnActive} intervention={preWarnIv} />

      {/* Tactical HUD Alert Stack — stacked neatly, clear of both sidebars */}
      <div style={{
        position: "fixed", bottom: 16, right: 386, zIndex: 50,
        display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end",
        pointerEvents: "none"
      }}>
        <RPFAlert active={rpfActive} boothId="BOOTH-3" distance="120m" />
        <PhoneNotification notification={phoneNotif} onDismiss={dismissPhone} />
      </div>

      <EmergencyOverlay
        active={sosActive}
        sosIntervention={activeSos ?? undefined}
        onDismiss={() => setActiveSos(null)}
      />
      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        demoActive={liveMode === "scenario" && demoStarted}
        onThresholdsApplied={() => launchDemo(demoMaxLevel)}
      />
      <VideoSourcePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(source) => { startLive(source); setPickerOpen(false); }}
      />
      <AuditDossierModal
        isOpen={auditOpen}
        onClose={() => setAuditOpen(false)}
      />
    </div>
    </>
  );
}

function Divider() {
  return <div style={{ width: 1, height: 18, background: "var(--hair)", flexShrink: 0 }} />;
}

/** A radar contact standing in for a watchman's mark — JanKavach means public shield/sentinel. */
function SentinelMark() {
  return (
    <svg width={22} height={22} viewBox="0 0 22 22" style={{ flexShrink: 0 }}>
      <rect x={0.5} y={0.5} width={21} height={21} fill="var(--panel)" stroke="var(--sweep)" strokeWidth={1} />
      <circle cx={11} cy={11} r={6.5} fill="none" stroke="var(--sweep)" strokeWidth={1} opacity={0.5} />
      <circle cx={11} cy={11} r={2} fill="var(--sweep)" />
    </svg>
  );
}
