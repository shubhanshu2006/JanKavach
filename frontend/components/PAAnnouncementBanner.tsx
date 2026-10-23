"use client";
import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Megaphone } from "lucide-react";

interface Props {
  message: string | null;
  zone: string;
  onDismiss: () => void;
}

export default function PAAnnouncementBanner({ message, zone, onDismiss }: Props) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDismiss, 7000);
    return () => clearTimeout(t);
  }, [message, onDismiss]);

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", damping: 22, stiffness: 220 }}
          className="fixed bottom-3 left-3 right-3 z-50 pointer-events-none"
        >
          <div className="panel scope mx-auto max-w-2xl px-4 py-3" style={{ borderColor: "var(--amber)" }}>
            <div className="flex items-center gap-4">
              <div className="relative shrink-0 w-9 h-9 flex items-center justify-center">
                <Megaphone size={16} color="var(--amber)" strokeWidth={1.75} className="z-10" />
                {[1, 2, 3].map((i) => (
                  <motion.div
                    key={i}
                    className="absolute inset-0 rounded-full"
                    style={{ border: "1px solid var(--amber)" }}
                    initial={{ scale: 0.6, opacity: 0.8 }}
                    animate={{ scale: 1.5 + i * 0.3, opacity: 0 }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.25, ease: "easeOut" }}
                  />
                ))}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span style={{ fontSize: 10, color: "var(--amber)", letterSpacing: "0.14em" }} className="font-bold uppercase">
                    PA Announcement
                  </span>
                  <span style={{ fontSize: 9, color: "var(--text-mute)", border: "1px solid var(--hair)" }} className="px-1.5">{zone}</span>
                  <span style={{ fontSize: 9, color: "var(--text-faint)" }} className="ml-auto">Auto-issued by JanKavach · L1</span>
                </div>
                <div className="overflow-hidden">
                  <motion.p
                    initial={{ x: "100%" }}
                    animate={{ x: "-100%" }}
                    transition={{ duration: 10, ease: "linear" }}
                    style={{ fontSize: 12, color: "var(--text)" }}
                    className="whitespace-nowrap font-medium"
                  >
                    {message}
                  </motion.p>
                </div>
              </div>

              <div className="shrink-0 text-center px-2 py-1" style={{ background: "var(--sweep-glow)", border: "1px solid var(--sweep)" }}>
                <div style={{ fontSize: 11, color: "var(--sweep)" }} className="font-bold">L1</div>
                <div style={{ fontSize: 8, color: "var(--sweep-dim)" }}>AUTO</div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
