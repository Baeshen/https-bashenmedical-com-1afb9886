import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import bmcLogo from "@/assets/baeshen-logo.png";

const STORAGE_KEY = "baeshen_intro_seen_v2";

const CHARCOAL = "#0d1218";
const CHARCOAL_SOFT = "#141b24";
const CRESCENT_RED = "#d93a3a";
const BAESHEN_BLUE = "#1e3a5f";
const SILVER = "#d7dce3";
const GOLD = "#c9a84c";

type Scene = {
  key: string;
  icon: JSX.Element;
  ar: string;
  en: string;
};

const SceneIcon = ({ children }: { children: React.ReactNode }) => (
  <svg viewBox="0 0 64 64" className="w-16 h-16 md:w-20 md:h-20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

const SCENES: Scene[] = [
  {
    key: "consult",
    ar: "استشارات طبية",
    en: "Medical Consultations",
    icon: (
      <SceneIcon>
        <path d="M20 44c0-6.6 5.4-12 12-12s12 5.4 12 12" />
        <circle cx={32} cy={22} r={7} />
        <path d="M14 52h36" />
      </SceneIcon>
    ),
  },
  {
    key: "dental",
    ar: "طب الأسنان",
    en: "Dental Care",
    icon: (
      <SceneIcon>
        <path d="M22 14c-5 0-8 3-8 9 0 6 3 10 5 18 1 4 2 7 4 7s2-4 3-9 2-6 6-6 5 1 6 6 1 9 3 9 3-3 4-7c2-8 5-12 5-18 0-6-3-9-8-9-3 0-5 2-9 2s-6-2-11-2z" />
      </SceneIcon>
    ),
  },
  {
    key: "pediatrics",
    ar: "طب الأطفال",
    en: "Pediatrics",
    icon: (
      <SceneIcon>
        <circle cx={32} cy={22} r={9} />
        <path d="M27 21h.01M37 21h.01" />
        <path d="M28 26c1 1.5 2.5 2 4 2s3-.5 4-2" />
        <path d="M18 52c0-7 6-13 14-13s14 6 14 13" />
      </SceneIcon>
    ),
  },
  {
    key: "lab",
    ar: "المختبرات",
    en: "Laboratory",
    icon: (
      <SceneIcon>
        <path d="M26 10v14L16 46a4 4 0 003.5 6h25A4 4 0 0048 46L38 24V10" />
        <path d="M23 10h18" />
        <path d="M22 36h20" />
      </SceneIcon>
    ),
  },
  {
    key: "pharmacy",
    ar: "الصيدلية",
    en: "Pharmacy",
    icon: (
      <SceneIcon>
        <rect x={12} y={20} width={40} height={24} rx={12} />
        <path d="M32 20v24" />
      </SceneIcon>
    ),
  },
  {
    key: "booking",
    ar: "حجز إلكتروني",
    en: "Online Booking",
    icon: (
      <SceneIcon>
        <rect x={12} y={16} width={40} height={36} rx={4} />
        <path d="M12 26h40M22 12v8M42 12v8" />
        <path d="M26 38l4 4 8-8" />
      </SceneIcon>
    ),
  },
];

export function IntroOverlay({ theme = "dark" as "dark" | "light" }) {
  void theme;
  const prefersReducedMotion = useReducedMotion();
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);
  const [muted, setMuted] = useState(true);
  const [audioReady, setAudioReady] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const heartbeatTimerRef = useRef<number | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (sessionStorage.getItem(STORAGE_KEY)) return;
    } catch {}
    setVisible(true);
  }, []);

  const finish = () => {
    if (fading) return;
    setFading(true);
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {}
    stopHeartbeat();
    setTimeout(() => setVisible(false), 600);
  };

  const goBook = () => {
    finish();
    setTimeout(() => navigate({ to: "/book" }).catch(() => {}), 620);
  };

  // Auto-dismiss after 10s
  useEffect(() => {
    if (!visible) return;
    const total = prefersReducedMotion ? 2200 : 10200;
    const t = window.setTimeout(finish, total);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, prefersReducedMotion]);

  // Web audio heartbeat (only when user unmutes)
  const startHeartbeat = () => {
    try {
      const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      if (!Ctx) return;
      const ctx = audioCtxRef.current ?? new Ctx();
      audioCtxRef.current = ctx;
      const beat = (delay: number, freq = 60, gain = 0.25) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine";
        o.frequency.value = freq;
        const now = ctx.currentTime + delay;
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(gain, now + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
        o.connect(g).connect(ctx.destination);
        o.start(now);
        o.stop(now + 0.3);
      };
      const cycle = () => {
        beat(0, 62, 0.28);
        beat(0.18, 55, 0.22);
      };
      cycle();
      heartbeatTimerRef.current = window.setInterval(cycle, 1000);
      setAudioReady(true);
    } catch {}
  };

  const stopHeartbeat = () => {
    if (heartbeatTimerRef.current) {
      window.clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
    try {
      audioCtxRef.current?.close();
    } catch {}
    audioCtxRef.current = null;
    setAudioReady(false);
  };

  const toggleMute = () => {
    if (muted) {
      startHeartbeat();
      setMuted(false);
    } else {
      stopHeartbeat();
      setMuted(true);
    }
  };

  useEffect(() => () => stopHeartbeat(), []);

  // Timeline (ms)
  const T = useMemo(
    () => ({
      crescent: 0, // 0-2s
      bmc: 2000, // 2-4s
      scenes: 4000, // 4-7s
      logoReveal: 7000, // 7-9s
      cta: 9000, // 9-10s
    }),
    [],
  );

  if (!visible) return null;

  // Reduced motion: static fallback with logo + skip
  if (prefersReducedMotion) {
    return (
      <div dir="rtl" className="fixed inset-0 z-[9999] bg-[#0d1218] flex flex-col items-center justify-center gap-6 px-6">
        <img src={bmcLogo} alt="مجمع باعشن الطبي" className="w-40 h-40 object-contain" />
        <p className="text-white/80 text-lg" style={{ fontFamily: "Cairo, sans-serif" }}>
          مجمع باعشن الطبي — صحتك أولويتنا
        </p>
        <button
          onClick={finish}
          className="mt-2 rounded-full bg-white/10 hover:bg-white/20 text-white/90 px-6 py-2 text-sm"
        >
          الدخول للموقع
        </button>
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      role="dialog"
      aria-label="مقدمة مجمع باعشن الطبي"
      className={`fixed inset-0 z-[9999] overflow-hidden transition-opacity duration-700 ${fading ? "opacity-0" : "opacity-100"}`}
      style={{
        background: `radial-gradient(ellipse at center, ${CHARCOAL_SOFT} 0%, ${CHARCOAL} 70%)`,
        fontFamily: "Cairo, sans-serif",
      }}
    >
      {/* Soft ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 50% 55%, rgba(30,58,95,0.35), transparent 55%)`,
        }}
      />
      {/* Grain */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.06] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>\")",
        }}
      />

      {/* Top controls */}
      <div className="absolute top-5 md:top-8 inset-x-5 md:inset-x-10 flex justify-between items-center z-30">
        <button
          onClick={toggleMute}
          className="flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] hover:bg-white/[0.1] backdrop-blur-md px-4 py-2 transition"
          aria-label={muted ? "تشغيل الصوت" : "كتم الصوت"}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${audioReady ? "bg-emerald-400" : "bg-white/40"}`}
          />
          <span className="text-[10px] tracking-[0.3em] uppercase text-white/80">
            {muted ? "الصوت" : "كتم"}
          </span>
        </button>

        <button
          onClick={finish}
          className="flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] hover:bg-white/[0.1] backdrop-blur-md px-4 py-2 transition"
          aria-label="تخطي المقدمة"
        >
          <span className="text-[10px] tracking-[0.3em] uppercase text-white/80">تخطي</span>
          <svg className="w-3 h-3 text-white/70 rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Stage */}
      <div className="relative z-10 h-full w-full flex items-center justify-center">
        {/* 0-2s: crescent draw */}
        <motion.div
          className="absolute"
          initial={{ opacity: 1 }}
          animate={{ opacity: [1, 1, 0] }}
          transition={{ duration: 4, times: [0, 0.5, 1], ease: "easeInOut" }}
        >
          <svg viewBox="0 0 200 200" className="w-56 h-56 md:w-72 md:h-72">
            <defs>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {/* Crescent shape drawn as a path */}
            <motion.path
              d="M140 40 A70 70 0 1 0 140 160 A55 55 0 1 1 140 40 Z"
              fill="none"
              stroke={CRESCENT_RED}
              strokeWidth={4}
              strokeLinecap="round"
              filter="url(#glow)"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 1.6, ease: "easeInOut" }}
            />
            <motion.path
              d="M140 40 A70 70 0 1 0 140 160 A55 55 0 1 1 140 40 Z"
              fill={CRESCENT_RED}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0, 0.9] }}
              transition={{ duration: 2, times: [0, 0.75, 1] }}
            />
          </svg>
        </motion.div>

        {/* 2-4s: B.M.C letters + silver/blue circle assembly */}
        <motion.div
          className="absolute flex flex-col items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 1, 0] }}
          transition={{ duration: 3, delay: T.bmc / 1000, times: [0, 0.15, 0.85, 1] }}
        >
          <svg viewBox="0 0 220 220" className="w-60 h-60 md:w-80 md:h-80">
            {/* Silver outer ring */}
            <motion.circle
              cx={110}
              cy={110}
              r={95}
              fill="none"
              stroke={SILVER}
              strokeWidth={1.5}
              strokeDasharray="4 6"
              initial={{ pathLength: 0, rotate: -90, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.7 }}
              transition={{ duration: 1.4, delay: 0.1 }}
              style={{ transformOrigin: "50% 50%" }}
            />
            {/* Blue inner ring */}
            <motion.circle
              cx={110}
              cy={110}
              r={80}
              fill="none"
              stroke={BAESHEN_BLUE}
              strokeWidth={2}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 1.4, delay: 0.4 }}
            />
            {/* crescent behind text */}
            <path
              d="M148 55 A55 55 0 1 0 148 165 A43 43 0 1 1 148 55 Z"
              fill={CRESCENT_RED}
              opacity={0.95}
            />
            {/* B.M.C */}
            <motion.text
              x={110}
              y={122}
              textAnchor="middle"
              fill="#ffffff"
              fontSize={28}
              fontWeight={700}
              letterSpacing={2}
              style={{ fontFamily: "Cairo, sans-serif" }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.7 }}
            >
              B.M.C
            </motion.text>
          </svg>
        </motion.div>

        {/* 4-7s: Scenes strip */}
        <motion.div
          className="absolute inset-0 flex flex-col items-center justify-center gap-8 px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 1, 0] }}
          transition={{ duration: 3, delay: T.scenes / 1000, times: [0, 0.1, 0.85, 1] }}
        >
          <div className="grid grid-cols-3 md:grid-cols-6 gap-5 md:gap-8 text-white/90">
            {SCENES.map((s, i) => (
              <motion.div
                key={s.key}
                className="flex flex-col items-center gap-2"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: T.scenes / 1000 + 0.1 + i * 0.12, duration: 0.5 }}
                style={{ color: i % 2 === 0 ? SILVER : "#9ec5e8" }}
              >
                {s.icon}
                <span className="text-[10px] md:text-xs text-white/70 tracking-wide">{s.ar}</span>
              </motion.div>
            ))}
          </div>
          <motion.div
            className="text-center space-y-2"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: T.scenes / 1000 + 1, duration: 0.6 }}
          >
            <p className="text-white text-2xl md:text-4xl font-semibold" style={{ fontFamily: "Cairo, sans-serif" }}>
              رعاية متكاملة… بخبرة نثق بها
            </p>
            <p className="text-white/60 text-sm md:text-base tracking-wide">
              Integrated Care. Trusted Expertise.
            </p>
          </motion.div>
        </motion.div>

        {/* 7-9s: full logo reveal with light sweep */}
        <motion.div
          className="absolute flex flex-col items-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: [0, 1, 1, 1], scale: [0.92, 1, 1, 1] }}
          transition={{ duration: 3, delay: T.logoReveal / 1000, times: [0, 0.2, 0.85, 1] }}
        >
          <div className="relative">
            <div
              className="absolute -inset-8 rounded-full"
              style={{ boxShadow: `0 0 90px 10px ${BAESHEN_BLUE}55` }}
            />
            <img
              src={bmcLogo}
              alt="مجمع باعشن الطبي"
              className="relative w-52 h-52 md:w-64 md:h-64 object-contain drop-shadow-[0_10px_40px_rgba(0,0,0,0.6)]"
            />
            {/* light sweep */}
            <motion.div
              className="absolute inset-0 overflow-hidden rounded-full pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 1.6, delay: T.logoReveal / 1000 + 0.4 }}
            >
              <motion.div
                className="absolute top-0 -left-1/2 w-1/2 h-full"
                style={{
                  background:
                    "linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.55) 50%, transparent 70%)",
                  filter: "blur(6px)",
                }}
                initial={{ x: "-100%" }}
                animate={{ x: "350%" }}
                transition={{ duration: 1.6, delay: T.logoReveal / 1000 + 0.4, ease: "easeInOut" }}
              />
            </motion.div>
          </div>
        </motion.div>

        {/* 9-10s: CTA / titles */}
        <AnimatePresence>
          <motion.div
            key="cta"
            className="absolute bottom-16 md:bottom-24 inset-x-0 flex flex-col items-center gap-3 px-6 text-center"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: T.cta / 1000, duration: 0.6 }}
          >
            <p className="text-white text-xl md:text-3xl font-bold" style={{ fontFamily: "Cairo, sans-serif" }}>
              مجمع باعشن الطبي
            </p>
            <p className="text-white/70 text-sm md:text-base" style={{ fontFamily: "Cairo, sans-serif" }}>
              صحتك… أولويتنا
            </p>
            <button
              onClick={goBook}
              className="mt-3 inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm md:text-base font-semibold text-white shadow-lg transition hover:scale-[1.03]"
              style={{
                background: `linear-gradient(135deg, ${BAESHEN_BLUE}, ${CRESCENT_RED})`,
                boxShadow: `0 10px 30px ${CRESCENT_RED}55`,
              }}
            >
              احجز موعدك الآن
              <span className="text-xs text-white/80">· Book Your Appointment</span>
            </button>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom progress bar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-56 h-[2px] bg-white/10 overflow-hidden rounded-full">
        <motion.div
          className="h-full"
          style={{ background: `linear-gradient(90deg, ${GOLD}, ${SILVER})` }}
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ duration: 10, ease: "linear" }}
        />
      </div>
    </div>
  );
}
