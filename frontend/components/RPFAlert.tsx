"use client";
import { motion, AnimatePresence } from "framer-motion";
import { Siren } from "lucide-react";

interface Props {
  active: boolean;
  boothId: string;
  distance?: string;
}

export default function RPFAlert({ active, boothId, distance = "120m" }: Props) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.85 }}
          transition={{ duration: 0.3 }}
          className="fixed bottom-20 right-4 w-52 pointer-events-none z-50"
        >
          <div className="panel relative p-4" style={{ borderColor: "var(--red)" }}>
            <div className="relative w-16 h-16 mx-auto mb-3">
              {[0, 1, 2, 3].map((i) => (
                <motion.div
                  key={i}
                  className="absolute inset-0 rounded-full"
                  style={{ border: "1.5px solid var(--red)" }}
                  initial={{ scale: 0.3, opacity: 0.9 }}
                  animate={{ scale: 2.5 + i * 0.5, opacity: 0 }}
                  transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.35, ease: "easeOut" }}
                />
              ))}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "rgba(255,59,59,0.15)", border: "1.5px solid var(--red)" }}>
                  <Siren size={18} color="var(--red)" strokeWidth={1.75} />
                </div>
              </div>
            </div>

            <div className="text-center scope">
              <div style={{ fontSize: 11, color: "var(--red)", letterSpacing: "0.14em" }} className="font-bold mb-1">RPF DISPATCH</div>
              <div style={{ fontSize: 13, color: "var(--text)" }} className="font-bold mb-1">{boothId}</div>
              <div style={{ fontSize: 10, color: "var(--text-mute)" }}>Nearest booth · {distance}</div>
              <div className="mt-2 px-2 py-1" style={{ fontSize: 9, color: "#FF9B9B", background: "rgba(255,59,59,0.08)" }}>
                L2 · Requested by JanKavach, pending confirm
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
