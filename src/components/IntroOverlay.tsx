import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import {
  Stethoscope, Baby, HeartPulse, Bluetooth as Tooth, Eye, FlaskConical, Pill,
  Home, Video, CalendarCheck, ShieldCheck, Users, Activity, Award, Building2,
  Clock, Star, ClipboardList,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/analytics";
import bmcLogoAsset from "@/assets/baeshen-logo.asset.json";

const bmcLogo = bmcLogoAsset.url;

const SESSION_KEY = "baeshen_intro_seen_v3";
const DISABLE_KEY = "baeshen_intro_disabled";
const ANALYTICS_STATE_KEY = "baeshen_intro_analytics_v1";

type IntroOutcome =
  | "skip"
  | "complete"
  | "cta_book"
  | "cta_services"
  | "disabled_forever"
  | "reduced_motion_close";

type IntroAnalyticsState = {
  shown_at: number;
  outcome?: IntroOutcome;
  outcome_at?: number;
  elapsed_ms?: number;
  scene?: string;
  variant?: "full" | "reduced";
};

function readAnalyticsState(): IntroAnalyticsState | null {
  try {
    const raw = sessionStorage.getItem(ANALYTICS_STATE_KEY);
    return raw ? (JSON.parse(raw) as IntroAnalyticsState) : null;
  } catch {
    return null;
  }
}

function writeAnalyticsState(state: IntroAnalyticsState) {
  try {
    sessionStorage.setItem(ANALYTICS_STATE_KEY, JSON.stringify(state));
  } catch {
    /* noop */
  }
}

function sceneFromMs(ms: number): string {
  if (ms < 4000) return "pulse";
  if (ms < 8000) return "brand";
  if (ms < 16000) return "services";
  if (ms < 23000) return "stats";
  if (ms < 27000) return "booking";
  return "final";
}

const CHARCOAL = "#0a0f16";
const CHARCOAL_SOFT = "#111823";
const CRESCENT_RED = "#c8232c";
const BAESHEN_BLUE = "#1e3a5f";
const BAESHEN_BLUE_SOFT = "#2f5a8f";
const SILVER = "#d7dce3";
const GOLD = "#c9a84c";

const TOTAL_MS = 30_000;

// ---------------------------------------------------------------------------
// Data-driven service list
// ---------------------------------------------------------------------------
type IntroService = {
  id: string;
  titleAr: string;
  titleEn: string;
  Icon: LucideIcon;
};

const SERVICES: IntroService[] = [
  { id: "clinics",     titleAr: "العيادات التخصصية", titleEn: "Specialty Clinics", Icon: Stethoscope },
  { id: "internal",    titleAr: "الباطنية",          titleEn: "Internal Medicine", Icon: HeartPulse },
  { id: "pediatrics",  titleAr: "طب الأطفال",        titleEn: "Pediatrics",        Icon: Baby },
  { id: "obgyn",       titleAr: "النساء والولادة",   titleEn: "OB-GYN",            Icon: Users },
  { id: "dental",      titleAr: "طب الأسنان",        titleEn: "Dentistry",         Icon: Tooth },
  { id: "eye",         titleAr: "طب العيون",         titleEn: "Ophthalmology",     Icon: Eye },
  { id: "lab",         titleAr: "المختبر",           titleEn: "Laboratory",        Icon: FlaskConical },
  { id: "pharmacy",    titleAr: "الصيدلية",          titleEn: "Pharmacy",          Icon: Pill },
  { id: "home",        titleAr: "الرعاية المنزلية",  titleEn: "Home Care",         Icon: Home },
  { id: "telemed",     titleAr: "الاستشارات عن بُعد", titleEn: "Telemedicine",      Icon: Video },
  { id: "booking",     titleAr: "حجز إلكتروني",      titleEn: "Online Booking",    Icon: CalendarCheck },
];

// ---------------------------------------------------------------------------
// Public statistics — quietly hides any value that fails to load
// ---------------------------------------------------------------------------
type Stat = {
  id: string;
  labelAr: string;
  value: number;
  suffix?: string;
  prefix?: string;
  Icon: LucideIcon;
  source: string;      // Arabic, user-facing source description
  updatedAt: number;   // epoch ms
  live?: boolean;      // true = pulled from live database this session
};

function useIntroPreferences() {
  const [disabled, setDisabled] = useState(false);
  useEffect(() => {
    try { setDisabled(localStorage.getItem(DISABLE_KEY) === "1"); } catch { /* noop */ }
  }, []);
  return { disabled };
}

// Static values — reviewed & approved for public display
const STATIC_STAT_REVIEW_DATE = Date.parse("2026-01-15T00:00:00Z");

function usePublicClinicStatistics(enabled: boolean) {
  const [stats, setStats] = useState<Stat[]>([]);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      const results = await Promise.allSettled([
        supabase.from("doctors").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("doctors").select("specialty_id", { count: "exact", head: true }).eq("is_active", true),
      ]);
      if (cancelled) return;
      const now = Date.now();
      const out: Stat[] = [];
      const doctors = results[0].status === "fulfilled" ? results[0].value.count ?? null : null;
      if (doctors && doctors > 0) {
        out.push({
          id: "doctors", labelAr: "طبيبًا واستشاريًا", value: doctors, prefix: "+", Icon: Users,
          source: "قاعدة بيانات المجمع — الأطباء النشطون",
          updatedAt: now, live: true,
        });
      }
      // Fallback / evergreen public values
      out.push({
        id: "years", labelAr: "سنوات من الخبرة", value: 15, prefix: "+", Icon: Award,
        source: "بيانات معتمدة من إدارة المجمع", updatedAt: STATIC_STAT_REVIEW_DATE,
      });
      out.push({
        id: "sat",   labelAr: "رضا المرضى",       value: 98, suffix: "%", Icon: Star,
        source: "استبيانات رضا المرضى الداخلية", updatedAt: STATIC_STAT_REVIEW_DATE,
      });
      out.push({
        id: "care",  labelAr: "رعاية طوال الأسبوع", value: 7, suffix: " أيام", Icon: Clock,
        source: "جدول عمل المجمع الرسمي", updatedAt: STATIC_STAT_REVIEW_DATE,
      });
      setStats(out);
    })();
    return () => { cancelled = true; };
  }, [enabled]);
  return stats;
}

function formatUpdatedAt(ms: number): string {
  try {
    return new Intl.DateTimeFormat("ar-SA", {
      year: "numeric", month: "long", day: "numeric",
    }).format(new Date(ms));
  } catch {
    return new Date(ms).toLocaleDateString();
  }
}


// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
function useTicker(active: boolean) {
  const [ms, setMs] = useState(0);
  useEffect(() => {
    if (!active) return;
    const start = performance.now();
    let raf = 0;
    const loop = (t: number) => {
      setMs(t - start);
      if (t - start < TOTAL_MS) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [active]);
  return ms;
}

function Counter({ value, prefix = "", suffix = "" }: { value: number; prefix?: string; suffix?: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const dur = 1400;
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      setN(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span>{prefix}{n.toLocaleString("ar-EG")}{suffix}</span>;
}

// ---------------------------------------------------------------------------
// Overlay
// ---------------------------------------------------------------------------
export function IntroOverlay({ theme = "dark" as "dark" | "light" }) {
  void theme;
  const prefersReducedMotion = useReducedMotion();
  const { disabled } = useIntroPreferences();
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);
  const [muted, setMuted] = useState(true);
  const [audioReady, setAudioReady] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const [audioFailed, setAudioFailed] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const heartbeatTimerRef = useRef<number | null>(null);
  const shownAtRef = useRef<number>(0);
  const shownFiredRef = useRef(false);
  const outcomeFiredRef = useRef(false);
  const msRef = useRef(0);
  const skipBtnRef = useRef<HTMLButtonElement | null>(null);
  const reducedCloseBtnRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const navigate = useNavigate();

  const [announcedScene, setAnnouncedScene] = useState<string>("");
  const sceneLabels: Record<string, string> = useMemo(() => ({
    pulse: "المشهد الأول: نبض من قلب جازان",
    brand: "المشهد الثاني: هوية مجمع باعشن الطبي",
    services: "المشهد الثالث: خدماتنا الطبية",
    stats: "المشهد الرابع: أرقامنا",
    booking: "المشهد الخامس: خطوات الحجز",
    final: "المشهد الأخير: احجز موعدك الآن",
    reduced: "مقدمة مختصرة لمجمع باعشن الطبي",
  }), []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (disabled) return;
    try { if (sessionStorage.getItem(SESSION_KEY)) return; } catch { /* noop */ }
    setVisible(true);
  }, [disabled]);

  const ms = useTicker(visible && !prefersReducedMotion);
  useEffect(() => { msRef.current = ms; }, [ms]);
  const stats = usePublicClinicStatistics(visible);

  // Sync aria-live announcements with scene changes
  const currentScene = prefersReducedMotion ? "reduced" : sceneFromMs(ms);
  useEffect(() => {
    if (!visible) return;
    setAnnouncedScene(sceneLabels[currentScene] ?? "");
  }, [visible, currentScene, sceneLabels]);

  // Announce when live statistics finish loading
  const [statsAnnouncement, setStatsAnnouncement] = useState<string>("");
  useEffect(() => {
    if (!visible || currentScene !== "stats" || stats.length === 0) return;
    const parts = stats
      .filter((s) => s.value > 0)
      .slice(0, 4)
      .map((s) => `${s.prefix ?? ""}${s.value}${s.suffix ?? ""} ${s.labelAr}`);
    if (parts.length) setStatsAnnouncement(`تحديث الإحصائيات: ${parts.join("، ")}`);
  }, [visible, currentScene, stats]);


  // Fire `intro_shown` once per session when the overlay first appears
  useEffect(() => {
    if (!visible || shownFiredRef.current) return;
    shownFiredRef.current = true;
    shownAtRef.current = Date.now();
    const variant: "full" | "reduced" = prefersReducedMotion ? "reduced" : "full";
    writeAnalyticsState({ shown_at: shownAtRef.current, variant });
    trackEvent("intro_shown", {
      variant,
      audio_muted_default: true,
      total_duration_ms: prefersReducedMotion ? 2500 : TOTAL_MS,
    });
  }, [visible, prefersReducedMotion]);

  const finish = (reason: IntroOutcome = "complete", target?: string) => {
    if (fading) return;
    setFading(true);
    try { sessionStorage.setItem(SESSION_KEY, "1"); } catch { /* noop */ }
    stopHeartbeat();

    if (!outcomeFiredRef.current) {
      outcomeFiredRef.current = true;
      const elapsed = shownAtRef.current ? Date.now() - shownAtRef.current : msRef.current;
      const scene = prefersReducedMotion ? "reduced" : sceneFromMs(msRef.current);
      const eventName = reason === "complete" ? "intro_completed" : "intro_skipped";
      const props = {
        reason,
        scene,
        elapsed_ms: elapsed,
        variant: prefersReducedMotion ? "reduced" : "full",
        audio_enabled: !muted,
        target: target ?? null,
      };
      trackEvent(eventName, props);
      // Persist the outcome so later code (or a debug panel) can see what happened this session
      const prev = readAnalyticsState() ?? { shown_at: shownAtRef.current || Date.now() };
      writeAnalyticsState({
        ...prev,
        outcome: reason,
        outcome_at: Date.now(),
        elapsed_ms: elapsed,
        scene,
        variant: prefersReducedMotion ? "reduced" : "full",
      });
    }

    setTimeout(() => {
      setVisible(false);
      if (target) navigate({ to: target }).catch(() => {});
    }, 500);
  };

  // Auto-finish
  useEffect(() => {
    if (!visible) return;
    const dur = prefersReducedMotion ? 2500 : TOTAL_MS + 200;
    const t = window.setTimeout(() => finish("complete"), dur);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, prefersReducedMotion]);

  const startHeartbeat = () => {
    try {
      const Ctx = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
      if (!Ctx) return;
      const ctx = audioCtxRef.current ?? new Ctx();
      audioCtxRef.current = ctx;
      const beat = (delay: number, freq = 60, gain = 0.22) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sine"; o.frequency.value = freq;
        const now = ctx.currentTime + delay;
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(gain, now + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
        o.connect(g).connect(ctx.destination);
        o.start(now); o.stop(now + 0.3);
      };
      const cycle = () => { beat(0, 62, 0.24); beat(0.2, 55, 0.18); };
      cycle();
      heartbeatTimerRef.current = window.setInterval(cycle, 1000);
      setAudioReady(true);
    } catch (err) {
      console.warn("[IntroOverlay] audio unavailable:", err);
      setAudioFailed(true); setAudioReady(false); setMuted(true);
    }
  };

  const stopHeartbeat = () => {
    if (heartbeatTimerRef.current) { window.clearInterval(heartbeatTimerRef.current); heartbeatTimerRef.current = null; }
    try { audioCtxRef.current?.close(); } catch { /* noop */ }
    audioCtxRef.current = null;
    setAudioReady(false);
  };

  const toggleMute = () => { if (muted) { startHeartbeat(); setMuted(false); } else { stopHeartbeat(); setMuted(true); } };

  useEffect(() => () => stopHeartbeat(), []);

  // Focus management: capture previous focus on open, focus Skip button,
  // restore focus on close. Also close on Escape.
  useEffect(() => {
    if (!visible) return;
    previousFocusRef.current = (document.activeElement as HTMLElement | null) ?? null;
    const target = prefersReducedMotion ? reducedCloseBtnRef.current : skipBtnRef.current;
    // Defer to next frame so the element is mounted and focusable
    const raf = requestAnimationFrame(() => target?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); finish("skip", undefined); }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      const prev = previousFocusRef.current;
      if (prev && typeof prev.focus === "function") {
        try { prev.focus(); } catch { /* noop */ }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, prefersReducedMotion]);

  const disableForever = () => {
    try { localStorage.setItem(DISABLE_KEY, "1"); } catch { /* noop */ }
    finish("disabled_forever");
  };

  // Timeline windows (ms)
  const T = useMemo(() => ({
    pulse:   [0,     4000],
    brand:   [4000,  8000],
    services:[8000,  16000],
    stats:   [16000, 23000],
    booking: [23000, 27000],
    final:   [27000, 30000],
  }), []);

  const inWindow = (w: number[]) => ms >= w[0] && ms < w[1];

  if (!visible) return null;

  // Reduced motion: 3-second logo reveal
  if (prefersReducedMotion) {
    return (
      <div
        dir="rtl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="intro-reduced-title"
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-6 px-6"
        style={{ background: CHARCOAL }}
      >
        {logoFailed ? <LogoTextFallback /> : (
          <img src={bmcLogo} alt="مجمع باعشن الطبي" onError={() => setLogoFailed(true)} className="w-44 h-44 object-contain" />
        )}
        <p id="intro-reduced-title" className="text-white/85 text-lg" style={{ fontFamily: "Cairo, sans-serif" }}>مجمع باعشن الطبي — صحتك أولويتنا</p>
        <button
          ref={reducedCloseBtnRef}
          onClick={() => finish("reduced_motion_close")}
          className="mt-2 rounded-full bg-white/10 hover:bg-white/20 text-white/90 px-6 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70"
        >
          الدخول للموقع
        </button>
        <span className="sr-only" aria-live="polite">{announcedScene}</span>
      </div>
    );
  }

  const progress = Math.min(1, ms / TOTAL_MS);

  return (
    <div
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="intro-dialog-title"
      aria-describedby="intro-scene-live"
      className={`fixed inset-0 z-[9999] overflow-hidden transition-opacity duration-500 ${fading ? "opacity-0" : "opacity-100"}`}
      style={{
        background: `radial-gradient(ellipse at 50% 40%, ${CHARCOAL_SOFT} 0%, ${CHARCOAL} 70%)`,
        fontFamily: "Cairo, sans-serif",
      }}
    >
      <h2 id="intro-dialog-title" className="sr-only">مقدمة مجمع باعشن الطبي</h2>
      {/* Live regions: scene changes and stat counters */}
      <div id="intro-scene-live" className="sr-only" aria-live="polite" aria-atomic="true">{announcedScene}</div>
      <div className="sr-only" aria-live="polite" aria-atomic="true">{statsAnnouncement}</div>
      {/* Ambient blue glow */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(circle at 50% 55%, rgba(30,58,95,0.35), transparent 60%)` }} />
      {/* Subtle grid */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.06]"
        style={{ backgroundImage: `linear-gradient(${SILVER}22 1px, transparent 1px), linear-gradient(90deg, ${SILVER}22 1px, transparent 1px)`, backgroundSize: "48px 48px" }} />

      {/* Top controls: skip always visible from second 1 */}
      <div className="absolute top-5 md:top-8 inset-x-5 md:inset-x-10 flex justify-between items-center z-30">
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMute}
            disabled={audioFailed}
            className="flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] hover:bg-white/[0.1] backdrop-blur-md px-4 py-2 transition disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label={audioFailed ? "الصوت غير متاح" : muted ? "تشغيل الصوت" : "كتم الصوت"}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${audioFailed ? "bg-white/20" : audioReady ? "bg-emerald-400" : "bg-white/40"}`} />
            <span className="text-[10px] tracking-[0.3em] uppercase text-white/80">{audioFailed ? "بدون صوت" : muted ? "الصوت" : "كتم"}</span>
          </button>
          <button
            onClick={disableForever}
            className="hidden md:flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] backdrop-blur-md px-3 py-2 text-[10px] tracking-[0.25em] uppercase text-white/60"
            aria-label="عدم عرض المقدمة مرة أخرى"
          >
            عدم العرض مجددًا
          </button>
        </div>

        <button
          ref={skipBtnRef}
          onClick={() => finish("skip")}
          className="flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.08] hover:bg-white/[0.15] backdrop-blur-md px-5 py-2.5 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80"
          aria-label="تخطي المقدمة والانتقال للصفحة الرئيسية (اضغط Escape)"
        >
          <span className="text-xs tracking-[0.3em] uppercase text-white/90">تخطي المقدمة</span>
          <svg aria-hidden="true" className="w-3.5 h-3.5 text-white/80 rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* ============ SCENES ============ */}
      <div className="relative z-10 h-full w-full">
        <AnimatePresence>
          {inWindow(T.pulse)     && <ScenePulse    key="pulse" />}
          {inWindow(T.brand)     && <SceneBrand    key="brand" logoFailed={logoFailed} onError={() => setLogoFailed(true)} />}
          {inWindow(T.services)  && <SceneServices key="services" />}
          {inWindow(T.stats)     && <SceneStats    key="stats" stats={stats} />}
          {inWindow(T.booking)   && <SceneBooking  key="booking" />}
          {inWindow(T.final)     && <SceneFinal    key="final" logoFailed={logoFailed} onError={() => setLogoFailed(true)} onBook={() => finish("cta_book", "/book")} onServices={() => finish("cta_services", "/services")} />}
        </AnimatePresence>
      </div>

      {/* Progress bar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-64 h-[2px] bg-white/10 overflow-hidden rounded-full">
        <div className="h-full" style={{ width: `${progress * 100}%`, background: `linear-gradient(90deg, ${GOLD}, ${SILVER})`, transition: "width 100ms linear" }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scenes
// ---------------------------------------------------------------------------
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const fadeSwap = {
  initial: { opacity: 0, scale: 0.98 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.6, ease: EASE } },
  exit:    { opacity: 0, scale: 1.02, transition: { duration: 0.5, ease: EASE } },
} as const;

function ScenePulse() {
  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center gap-8" {...fadeSwap}>
      <svg viewBox="0 0 600 200" className="w-[90%] max-w-3xl h-40">
        <defs>
          <filter id="pulseGlow"><feGaussianBlur stdDeviation="3" /></filter>
        </defs>
        <motion.path
          d="M0 100 L120 100 L150 100 L170 60 L190 140 L210 40 L230 160 L250 100 L600 100"
          fill="none" stroke={CRESCENT_RED} strokeWidth={3} strokeLinecap="round"
          filter="url(#pulseGlow)"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 2.2, ease: "easeInOut" }}
        />
        {/* crescent morph in from right */}
        <motion.path
          d="M480 100 A55 55 0 1 0 480 100.1 A42 42 0 1 1 480 100 Z"
          fill={CRESCENT_RED}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 2.0 }}
          style={{ transformOrigin: "480px 100px" }}
        />
      </svg>
      <motion.div
        className="text-center space-y-1"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2, duration: 0.7 }}
      >
        <p className="text-white text-2xl md:text-4xl font-semibold">من قلب جازان… تبدأ رعايتنا</p>
        <p className="text-white/60 text-sm md:text-base tracking-wide">From the Heart of Jazan, Our Care Begins</p>
      </motion.div>
    </motion.div>
  );
}

function SceneBrand({ logoFailed, onError }: { logoFailed: boolean; onError: () => void }) {
  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center gap-6" {...fadeSwap}>
      <div className="relative">
        <div className="absolute -inset-10 rounded-full" style={{ boxShadow: `0 0 90px 10px ${BAESHEN_BLUE}66` }} />
        {logoFailed ? <LogoTextFallback size="w-48 h-48 md:w-56 md:h-56" /> : (
          <motion.img
            src={bmcLogo}
            alt="مجمع باعشن الطبي"
            onError={onError}
            className="relative w-48 h-48 md:w-56 md:h-56 object-contain drop-shadow-[0_10px_40px_rgba(0,0,0,0.6)]"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, ease: EASE }}
          />
        )}
        {/* Silver sweep */}
        <div className="absolute inset-0 overflow-hidden rounded-full pointer-events-none">
          <motion.div
            className="absolute top-0 -left-1/2 w-1/2 h-full"
            style={{ background: "linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.5) 50%, transparent 70%)", filter: "blur(6px)" }}
            initial={{ x: "-100%" }}
            animate={{ x: "350%" }}
            transition={{ duration: 1.6, delay: 0.9, ease: "easeInOut" }}
          />
        </div>
      </div>
      <motion.div
        className="text-center space-y-1"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9, duration: 0.6 }}
      >
        <p className="text-white text-2xl md:text-3xl font-bold">مجمع باعشن الطبي</p>
        <p className="text-white/80 text-sm md:text-base">خبرة طبية متكاملة لرعاية تستحق الثقة</p>
        <p className="text-white/50 text-xs md:text-sm mt-1">Baeshen Medical Complex — Integrated Medical Expertise. Care You Can Trust.</p>
      </motion.div>
    </motion.div>
  );
}

function SceneServices() {
  // Show services in waves of 3
  const waves: IntroService[][] = [];
  for (let i = 0; i < SERVICES.length; i += 3) waves.push(SERVICES.slice(i, i + 3));
  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center gap-8 px-6" {...fadeSwap}>
      <p className="text-white/90 text-lg md:text-xl tracking-wide">خدماتنا الطبية</p>
      <div className="flex flex-col gap-6 w-full max-w-4xl">
        {waves.map((wave, wi) => (
          <motion.div
            key={wi}
            className="grid grid-cols-3 gap-4 md:gap-6"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: [0, 1, 1, 0], y: [14, 0, 0, -8] }}
            transition={{ duration: 2.0, delay: wi * 1.9, times: [0, 0.2, 0.85, 1] }}
            style={{ position: wi === 0 ? "relative" : "absolute", left: 0, right: 0 }}
          >
            {wave.map((s) => (
              <div key={s.id} className="flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm px-3 py-5 md:px-6 md:py-6">
                <s.Icon className="w-8 h-8 md:w-10 md:h-10" style={{ color: BAESHEN_BLUE_SOFT }} />
                <span className="text-white text-sm md:text-base font-medium text-center">{s.titleAr}</span>
                <span className="text-white/40 text-[10px] md:text-xs tracking-wide">{s.titleEn}</span>
              </div>
            ))}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function SceneStats({ stats }: { stats: Stat[] }) {
  const visible = stats.filter((s) => s.value > 0).slice(0, 4);
  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center gap-8 px-6" {...fadeSwap}>
      <motion.p
        className="text-white/70 text-xs md:text-sm tracking-[0.35em] uppercase"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 0.6 }}
      >
        أرقام تنمو بثقتكم · Numbers Made Possible by Your Trust
      </motion.p>
      <div className={`grid gap-4 md:gap-6 w-full max-w-5xl ${visible.length <= 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-2 md:grid-cols-4"}`}>
        {visible.map((s, i) => (
          <motion.div
            key={s.id}
            className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-5 md:p-6 flex flex-col items-center text-center gap-2"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.15, duration: 0.6 }}
          >
            <s.Icon className="w-6 h-6" style={{ color: GOLD }} />
            <div className="text-white text-2xl md:text-4xl font-bold">
              <Counter value={s.value} prefix={s.prefix} suffix={s.suffix} />
            </div>
            <div className="text-white/70 text-xs md:text-sm">{s.labelAr}</div>
          </motion.div>
        ))}
      </div>
      {visible.length === 0 && (
        <p className="text-white/50 text-sm">رعاية طبية متكاملة على مدار الأسبوع</p>
      )}
    </motion.div>
  );
}

function SceneBooking() {
  const steps = [
    { Icon: Building2, ar: "اختر الفرع" },
    { Icon: Stethoscope, ar: "اختر الطبيب" },
    { Icon: CalendarCheck, ar: "اختر الموعد" },
    { Icon: ShieldCheck, ar: "تأكيد الحجز" },
    { Icon: ClipboardList, ar: "استلام التفاصيل" },
  ];
  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center gap-8 px-6" {...fadeSwap}>
      <motion.p
        className="text-white text-2xl md:text-3xl font-semibold text-center"
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
      >
        موعدك الطبي… بخطوات بسيطة
      </motion.p>
      <p className="text-white/60 text-sm md:text-base">Your Appointment in a Few Simple Steps</p>
      <div className="w-full max-w-4xl">
        <div className="flex items-center justify-between gap-2 md:gap-4">
          {steps.map((st, i) => (
            <motion.div
              key={i}
              className="flex-1 flex flex-col items-center gap-2"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 + i * 0.35, duration: 0.5 }}
            >
              <div
                className="w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center border"
                style={{ borderColor: `${GOLD}66`, background: `${BAESHEN_BLUE}66` }}
              >
                <st.Icon className="w-6 h-6 text-white" />
              </div>
              <span className="text-white/85 text-[11px] md:text-sm text-center">{st.ar}</span>
              <span className="text-white/40 text-[10px]">{i + 1}</span>
            </motion.div>
          ))}
        </div>
        <motion.div
          className="mt-6 h-[2px] bg-white/10 overflow-hidden rounded"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
        >
          <motion.div
            className="h-full"
            style={{ background: `linear-gradient(90deg, ${BAESHEN_BLUE}, ${CRESCENT_RED})` }}
            initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: 3.4, ease: "easeInOut" }}
          />
        </motion.div>
      </div>
    </motion.div>
  );
}

function SceneFinal({
  logoFailed, onError, onBook, onServices,
}: { logoFailed: boolean; onError: () => void; onBook: () => void; onServices: () => void }) {
  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center gap-6 px-6" {...fadeSwap}>
      <div className="relative">
        <motion.div
          className="absolute -inset-10 rounded-full"
          style={{ background: `radial-gradient(circle, ${CRESCENT_RED}44, transparent 60%)` }}
          animate={{ scale: [1, 1.1, 1], opacity: [0.6, 0.9, 0.6] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
        {logoFailed ? <LogoTextFallback size="w-44 h-44 md:w-56 md:h-56" /> : (
          <img
            src={bmcLogo}
            alt="مجمع باعشن الطبي"
            onError={onError}
            className="relative w-44 h-44 md:w-56 md:h-56 object-contain drop-shadow-[0_10px_40px_rgba(0,0,0,0.6)]"
          />
        )}
      </div>
      <div className="text-center space-y-1">
        <p className="text-white text-2xl md:text-3xl font-bold">مجمع باعشن الطبي</p>
        <p className="text-white/75 text-sm md:text-base">صحتك… أولويتنا</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
        <button
          onClick={onBook}
          className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm md:text-base font-semibold text-white shadow-lg transition hover:scale-[1.03]"
          style={{ background: `linear-gradient(135deg, ${BAESHEN_BLUE}, ${CRESCENT_RED})`, boxShadow: `0 10px 30px ${CRESCENT_RED}55` }}
        >
          احجز موعدك الآن
        </button>
        <button
          onClick={onServices}
          className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm md:text-base font-medium text-white/90 border border-white/25 hover:bg-white/10 transition"
        >
          اكتشف خدماتنا
        </button>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Text fallback for when the logo image fails
// ---------------------------------------------------------------------------
function LogoTextFallback({ size = "w-40 h-40" }: { size?: string }) {
  return (
    <div
      role="img"
      aria-label="Baeshen Medical Complex"
      className={`${size} flex flex-col items-center justify-center rounded-full text-center`}
      style={{
        background: `radial-gradient(circle at 50% 45%, ${BAESHEN_BLUE} 0%, ${CHARCOAL_SOFT} 75%)`,
        border: `1px solid ${GOLD}55`,
        boxShadow: `0 0 40px ${BAESHEN_BLUE}66`,
      }}
    >
      <Activity className="w-8 h-8 mb-1" style={{ color: CRESCENT_RED }} />
      <span className="text-white text-xl md:text-2xl font-bold">B.M.C</span>
      <span className="mt-0.5 text-[10px] tracking-[0.3em] uppercase" style={{ color: GOLD }}>Baeshen Medical</span>
    </div>
  );
}
