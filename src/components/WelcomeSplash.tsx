import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import bmcLogo from "@/assets/baeshen-logo.png";

const KEY = "baeshen_welcome_seen_v1";

/**
 * Short (~1.6s) welcome screen shown once per session after the intro,
 * before the home page becomes fully interactive.
 */
export function WelcomeSplash() {
  const [visible, setVisible] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (sessionStorage.getItem(KEY)) return;
    } catch {}
    setVisible(true);
    const t = setTimeout(() => {
      try {
        sessionStorage.setItem(KEY, "1");
      } catch {}
      setVisible(false);
    }, reduce ? 400 : 1700);
    return () => clearTimeout(t);
  }, [reduce]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          dir="rtl"
          role="status"
          aria-label="أهلاً بكم في مجمع باعشن الطبي"
          className="fixed inset-0 z-[9998] flex items-center justify-center overflow-hidden bg-[#07101f]"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,217,192,0.18),rgba(7,16,31,0.95)_65%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_70%,rgba(123,97,255,0.18),transparent_60%)]" />

          <motion.div
            className="relative z-10 flex flex-col items-center text-center px-6"
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="relative">
              <motion.div
                className="absolute -inset-6 rounded-full border border-[#00D9C0]/30"
                animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0.2, 0.6] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.div
                className="absolute -inset-12 rounded-full border border-[#7B61FF]/20"
                animate={{ scale: [1, 1.25, 1], opacity: [0.5, 0.1, 0.5] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              />
              <div className="relative w-28 h-28 md:w-32 md:h-32 rounded-full bg-gradient-to-b from-[#132749] to-[#07101f] p-1 shadow-[0_0_60px_rgba(0,217,192,0.25)]">
                <div className="w-full h-full rounded-full border border-[#c9a84c]/30 bg-[#07101f] flex items-center justify-center overflow-hidden">
                  <img src={bmcLogo} alt="شركة باعشن الطبية" className="w-[85%] h-[85%] object-contain" />
                </div>
              </div>
            </div>

            <motion.p
              className="mt-8 text-[10px] tracking-[0.5em] uppercase text-[#00D9C0]/80 font-light"
              initial={{ opacity: 0, letterSpacing: "0.2em" }}
              animate={{ opacity: 1, letterSpacing: "0.5em" }}
              transition={{ delay: 0.15, duration: 0.7 }}
            >
              Welcome
            </motion.p>
            <motion.h2
              className="mt-3 text-2xl md:text-3xl text-[#e8edf3] tracking-wide"
              style={{ fontFamily: '"DM Serif Display","Instrument Serif",serif' }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.6 }}
            >
              أهلاً بكم في مجمع باعشن الطبي
            </motion.h2>

            <motion.div
              className="mt-6 h-px w-40 overflow-hidden bg-white/10"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.4 }}
            >
              <motion.div
                className="h-full bg-gradient-to-r from-transparent via-[#00D9C0] to-transparent"
                initial={{ x: "-100%" }}
                animate={{ x: "100%" }}
                transition={{ duration: 1.2, ease: "easeInOut" }}
              />
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
