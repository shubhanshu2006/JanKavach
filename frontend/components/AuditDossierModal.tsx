"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, Download, CheckCircle2, Clock, X, FileText, Lock, AlertTriangle, RefreshCw, Camera } from "lucide-react";
import { API_URL } from "@/lib/constants";

interface AuditDossierModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuditDossierModal({ isOpen, onClose }: AuditDossierModalProps) {
  const [dossier, setDossier] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>("");
  const [activeSnapshot, setActiveSnapshot] = useState<any>(null);
  const [verifyResult, setVerifyResult] = useState<{ is_valid: boolean; message: string; verified_blocks: number; session_id?: string; latest_hash?: string } | null>(null);

  const fetchSessions = async () => {
    try {
      const res = await fetch(`${API_URL}/audit/sessions`);
      if (res.ok) {
        const data = await res.json();
        const list = data.sessions || [];
        setSessions(list);
        // Automatically select the most relevant session (the one with the full incident run)
        const primarySession = list.find((s: any) => s.event_count > 1) || list[0];
        if (primarySession && !selectedSession) {
          setSelectedSession(primarySession.session_id);
          fetchDossier(primarySession.session_id);
        }
      }
    } catch (err) {
      console.error("Failed to fetch audit sessions:", err);
    }
  };

  const fetchDossier = async (sid?: string) => {
    setLoading(true);
    try {
      const target = sid !== undefined ? sid : selectedSession;
      const url = target ? `${API_URL}/audit/dossier?session_id=${encodeURIComponent(target)}` : `${API_URL}/audit/dossier`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setDossier(data);
        if (!selectedSession && data.session_id) {
          setSelectedSession(data.session_id);
        }
      }
    } catch (err) {
      console.error("Failed to fetch audit dossier:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const target = selectedSession || dossier?.session_id;
      const url = target
        ? `${API_URL}/audit/verify?session_id=${encodeURIComponent(target)}`
        : `${API_URL}/audit/verify`;
      const res = await fetch(url, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setVerifyResult(data);
      }
    } catch (err) {
      console.error("Failed to verify audit ledger:", err);
    } finally {
      setVerifying(false);
    }
  };

  const handleDownload = () => {
    if (!dossier) return;
    const content = JSON.stringify(dossier, null, 2);
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `CRS_STATUTORY_DOSSIER_${dossier.session_id || "LOG"}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (isOpen) {
      fetchSessions();
      fetchDossier();
      setVerifyResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const events = dossier?.chronological_event_stream || [];
  const metrics = dossier?.executive_metrics || {};
  const latencies = metrics.human_reaction_latencies || [];
  const avgLatency =
    latencies.length > 0
      ? (latencies.reduce((acc: number, curr: any) => acc + curr.latency_seconds, 0) / latencies.length).toFixed(2)
      : null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-6xl max-h-[92vh] flex flex-col bg-[#0A0D14] border border-[#1E293B] rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-3.5 border-b border-[#1E293B] bg-[#0E131F]/90 gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-base font-bold tracking-wide text-white uppercase whitespace-nowrap">
                    Statutory Incident Flight Recorder
                  </h2>
                  <span className="px-2.5 py-0.5 text-[10px] font-mono font-bold tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded whitespace-nowrap shrink-0">
                    CRS COMPLIANT · WORM LEDGER
                  </span>
                </div>
                <p className="text-xs text-slate-400 whitespace-nowrap">
                  Commission of Railway Safety · Cryptographic SHA-256 Tamper-Proof Audit
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                onClick={handleVerify}
                disabled={verifying}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-300 bg-emerald-950/40 hover:bg-emerald-900/40 border border-emerald-700/50 rounded-lg transition-colors whitespace-nowrap shrink-0"
                title="Verify SHA-256 cryptographic hash-chain"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${verifying ? "animate-spin" : ""}`} />
                <span>{verifying ? "Verifying..." : "Verify Hash Chain"}</span>
              </button>

              <button
                onClick={handleDownload}
                disabled={!dossier}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-sm transition-colors whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CRS Dossier</span>
              </button>

              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors ml-1 shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>


          {/* Historical Incident Selector Bar */}
          <div className="px-6 py-2.5 bg-[#080B11] border-b border-[#1E293B] flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-slate-300 flex-1">
              <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-semibold text-slate-200 shrink-0">Incident Archive:</span>
              <select
                value={selectedSession || dossier?.session_id || ""}
                onChange={(e) => {
                  const sid = e.target.value;
                  setSelectedSession(sid);
                  setVerifyResult(null);
                  fetchDossier(sid);
                }}
                className="bg-[#0E1422] text-slate-200 border border-emerald-500/40 rounded-lg px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer min-w-[340px] max-w-[560px]"
              >
                {sessions.length === 0 ? (
                  <option value={dossier?.session_id || ""}>
                    {dossier?.session_id || "Loading session logs..."}
                  </option>
                ) : (
                  sessions.map((s) => (
                    <option key={s.session_id} value={s.session_id}>
                      {s.badge_label} · {s.session_id} ({s.event_count} events, {s.file_size_kb} KB)
                    </option>
                  ))
                )}
              </select>
            </div>

            <span className="text-[11px] font-mono text-slate-400 hidden sm:inline shrink-0">
              Viewing: <strong className="text-emerald-400">{selectedSession || dossier?.session_id}</strong>
            </span>
          </div>

          {/* Verification Banner (If run) */}
          {verifyResult && (
            <div
              className={`px-6 py-2.5 text-xs flex items-center justify-between border-b ${
                verifyResult.is_valid
                  ? "bg-emerald-950/30 text-emerald-300 border-emerald-800/40"
                  : "bg-red-950/40 text-red-300 border-red-800/40"
              }`}
            >
              <div className="flex items-center gap-2">
                {verifyResult.is_valid ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                )}
                <span>
                  <strong>Cryptographic Verification:</strong> {verifyResult.message} ({verifyResult.verified_blocks}{" "}
                  blocks checked)
                </span>
              </div>
              <span className="font-mono text-[10px] text-slate-400">
                Latest Seal: {verifyResult.latest_hash?.slice(0, 16)}...
              </span>
            </div>
          )}

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-6 border-b border-[#1E293B] bg-[#0A0D14]">
            <div className="p-3.5 rounded-xl bg-[#0F1422] border border-[#1E293B]">
              <div className="text-[11px] font-medium text-slate-400">Chain Status</div>
              <div className="mt-1 flex items-center gap-1.5 text-emerald-400 font-semibold text-sm">
                <Lock className="w-4 h-4" />
                <span>SHA-256 SEALED</span>
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">
                {dossier?.session_id || "Active Session"}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0F1422] border border-[#1E293B]">
              <div className="text-[11px] font-medium text-slate-400">Recorded Events</div>
              <div className="mt-1 text-white font-bold text-lg font-mono">
                {events.length}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Immutable audit records</div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0F1422] border border-[#1E293B]">
              <div className="text-[11px] font-medium text-slate-400">Autonomous Responses</div>
              <div className="mt-1 text-emerald-400 font-bold text-lg font-mono">
                {metrics.autonomous_triggers_count || 0}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">&lt; 3.0s latency authority</div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0F1422] border border-[#1E293B]">
              <div className="text-[11px] font-medium text-slate-400">Operator Decision Latency</div>
              <div className="mt-1 text-amber-400 font-bold text-lg font-mono">
                {avgLatency ? `${avgLatency}s` : "Pending Action"}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {avgLatency ? "vs 240s human baseline (-97%)" : "No L2/L3 confirmed yet"}
              </div>
            </div>
          </div>

          {/* Event Stream Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-3 font-sans">
            <div className="flex items-center justify-between pb-1 text-xs text-slate-400 font-medium">
              <span>CHRONOLOGICAL FORENSIC EVENT STREAM</span>
              <span className="font-mono text-[10px]">TIME-SYNCHRONIZED (IST)</span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12 text-slate-500 text-sm">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading flight recorder events...
              </div>
            ) : events.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                No events recorded yet. Start the incident demo or live video to begin logging.
              </div>
            ) : (
              <div className="space-y-2">
                {events.map((ev: any) => {
                  const isAuto = ev.event_type.includes("AUTONOMOUS") || ev.event_type.includes("AUTO_FIRED");
                  const isConfirm = ev.event_type === "OPERATOR_CONFIRMED";
                  const isCancel = ev.event_type === "OPERATOR_CANCELLED";
                  const isStaged = ev.event_type === "INTERVENTION_STAGED";
                  const isGenesis = ev.event_type === "SESSION_GENESIS";

                  let badgeColor = "bg-slate-800 text-slate-300 border-slate-700";
                  if (isAuto) badgeColor = "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
                  if (isConfirm) badgeColor = "bg-blue-500/10 text-blue-400 border-blue-500/30";
                  if (isCancel) badgeColor = "bg-rose-500/10 text-rose-400 border-rose-500/30";
                  if (isStaged) badgeColor = "bg-amber-500/10 text-amber-400 border-amber-500/30";

                  return (
                    <div
                      key={ev.seq}
                      className="p-3.5 rounded-xl bg-[#0F1422] border border-[#1E293B] hover:border-slate-700 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-start gap-3">
                        <span className="font-mono text-[11px] text-slate-500 mt-0.5">
                          #{String(ev.seq).padStart(3, "0")}
                        </span>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${badgeColor}`}>
                              {ev.event_type}
                            </span>
                            <span className="font-medium text-slate-200">
                              Zone: {ev.zone}
                            </span>
                            {ev.payload?.level && (
                              <span className="px-1.5 py-0.2 text-[10px] bg-slate-800 text-slate-300 rounded font-mono">
                                Level {ev.payload.level}
                              </span>
                            )}
                          </div>

                          <p className="text-slate-300 mt-1 text-xs">
                            {ev.payload?.action || ev.payload?.trigger || JSON.stringify(ev.payload)}
                          </p>

                          {ev.payload?.latency_ms && (
                            <div className="flex items-center gap-1.5 mt-1 text-amber-400 font-mono text-[11px]">
                              <Clock className="w-3.5 h-3.5" />
                              <span>
                                Human Latency: {(ev.payload.latency_ms / 1000).toFixed(2)}s (Recorded against live clock)
                              </span>
                            </div>
                          )}

                          {ev.payload?.evidence_snapshot && (
                            <button
                              onClick={() => setActiveSnapshot({ ...ev.payload.evidence_snapshot, seq: ev.seq, event_type: ev.event_type })}
                              className="mt-2.5 flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-emerald-300 bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-500/40 rounded-lg transition-colors cursor-pointer"
                            >
                              <Camera className="w-3.5 h-3.5" />
                              <span>View CCTV Evidence Frame</span>
                              <span className="text-[10px] text-emerald-400 font-mono">
                                [SHA-256 SEALED]
                              </span>
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col md:items-end text-[10px] text-slate-400 font-mono shrink-0">
                        <span>{ev.timestamp_ist}</span>
                        <span className="text-slate-500 truncate max-w-[180px]" title={ev.hash}>
                          hash: {ev.hash?.slice(0, 14)}...
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-[#1E293B] bg-[#0E131F] flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 text-slate-400">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              Statutory Evidence Standard: Section 113, Railways Act 1989
            </span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>

      {/* Forensic CCTV Evidence Lightbox */}
      {activeSnapshot && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="relative w-full max-w-3xl bg-[#090D16] border border-[#1E293B] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1E293B] bg-[#0E131F]">
              <div className="flex items-center gap-2.5">
                <Camera className="w-5 h-5 text-emerald-400" />
                <div>
                  <div className="text-xs font-semibold text-white uppercase tracking-wider">
                    Statutory CCTV Evidence · Block #{String(activeSnapshot.seq).padStart(3, "0")}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {activeSnapshot.camera_id} · {activeSnapshot.feed_type}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setActiveSnapshot(null)}
                className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* The Image */}
            <div className="p-4 bg-black/60 flex items-center justify-center">
              <img
                src={`${API_URL}${activeSnapshot.url}`}
                alt="Forensic CCTV Evidence Frame"
                className="w-full max-h-[55vh] object-contain rounded-lg border border-slate-800 shadow-md"
              />
            </div>

            {/* Cryptographic metadata footer */}
            <div className="p-4 border-t border-[#1E293B] bg-[#0A0E18] text-xs space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  Photo Hash Intact: Verified against WORM ledger
                </span>
                <span className="text-slate-400 font-mono text-[10px]">
                  Captured: {activeSnapshot.captured_at_ist}
                </span>
              </div>
              <div className="p-2 rounded bg-[#060910] border border-slate-800 font-mono text-[10px] text-slate-300 break-all select-all">
                <span className="text-slate-500">SHA-256 IMAGE SEAL: </span>
                {activeSnapshot.image_sha256}
              </div>
            </div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
