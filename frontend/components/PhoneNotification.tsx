"use client";
import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wifi, BatteryFull } from "lucide-react";

interface Props {
  notification: { title: string; body: string; level: string } | null;
  onDismiss: () => void;
}

export default function PhoneNotification({ notification, onDismiss }: Props) {
  useEffect(() => {
    if (!notification) return;
    const t = setTimeout(onDismiss, 9000);
    return () => clearTimeout(t);
  }, [notification, onDismiss]);

  const levelColor =
    notification?.level === "L3" ? "var(--red)" :
    notification?.level === "L2" ? "var(--amber)" : "var(--sweep)";

  return (
    <AnimatePresence>
      {notification && (
        <motion.div
          initial={{ y: 200, x: 40, opacity: 0 }}
          animate={{ y: 0, x: 0, opacity: 1 }}
          exit={{ y: 200, opacity: 0 }}
          transition={{ type: "spring", damping: 18, stiffness: 180 }}
          className="fixed bottom-24 right-4 z-50 pointer-events-none"
        >
          {/* Phone frame — a diegetic device, not the scope's own chrome */}
          <div className="relative w-52 bg-[#0c0e0f] rounded-[28px] border-4 border-[#1c1f1f] shadow-2xl shadow-black/60 overflow-hidden p-1">
            <div className="rounded-[22px] overflow-hidden" style={{ background: "var(--bg)" }}>
              <div className="h-6 flex items-center justify-between px-4" style={{ background: "rgba(0,0,0,0.3)" }}>
                <span className="scope" style={{ fontSize: 9, color: "var(--text-dim)" }}>9:41</span>
                <div className="flex items-center gap-1.5">
                  <Wifi size={10} strokeWidth={2} color="var(--text-dim)" />
                  <BatteryFull size={12} strokeWidth={2} color="var(--text-dim)" />
                </div>
              </div>

              <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="mx-2 my-3 rounded-xl overflow-hidden"
                style={{ background: "var(--panel-2)", border: `1px solid ${levelColor}60` }}
              >
                <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: "1px solid var(--hair-dim)" }}>
                  <div
                    className="w-5 h-5 rounded-md flex items-center justify-center scope"
                    style={{ background: `${levelColor}30`, color: levelColor, fontSize: 9, fontWeight: 700 }}
                  >
                    JK
                  </div>
                  <span style={{ fontSize: 10, color: "var(--text)" }} className="font-semibold">JanKavach</span>
                  <span style={{ fontSize: 9, color: "var(--text-faint)" }} className="ml-auto">now</span>
                </div>

                <div className="px-3 py-2">
                  <p style={{ fontSize: 11, color: "var(--text)" }} className="font-bold mb-0.5">{notification.title}</p>
                  <p style={{ fontSize: 10, color: "var(--text-dim)" }} className="leading-relaxed">{notification.body}</p>

                  <div
                    className="mt-2 inline-block px-2 py-0.5 scope"
                    style={{ background: `${levelColor}20`, color: levelColor, fontSize: 9, fontWeight: 700 }}
                  >
                    {notification.level} ALERT
                  </div>
                </div>
              </motion.div>

              <div className="pb-3 flex justify-center">
                <div className="w-16 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }} />
              </div>
            </div>

            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-5 bg-[#0c0e0f] rounded-b-2xl" />
          </div>

          <motion.div
            className="absolute inset-0 rounded-[28px] pointer-events-none"
            style={{ boxShadow: `0 14px 36px -6px ${levelColor}70` }}
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
