import { useEffect, useRef, useState } from "react";
import darkVideo from "@/assets/baeshen-intro-dark.mp4.asset.json";
import lightVideo from "@/assets/baeshen-intro-light.mp4.asset.json";
import poster from "@/assets/baeshen-intro-poster.png.asset.json";
import bmcLogo from "@/assets/baeshen-logo.png";

const STORAGE_KEY = "baeshen_intro_seen_v1";

export function IntroOverlay({ theme = "dark" as "dark" | "light" }) {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);
  const [muted, setMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (sessionStorage.getItem(STORAGE_KEY)) return;
    } catch {}
    setVisible(true);
  }, []);

  const finish = () => {
    setFading(true);
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {}
    setTimeout(() => setVisible(false), 600);
  };

  useEffect(() => {
    if (!visible) return;
    const v = videoRef.current;
    if (!v) return;
    v.play().catch(() => {});
    const onEnd = () => finish();
    v.addEventListener("ended", onEnd);
    const t = setTimeout(finish, 11000);
    return () => {
      v.removeEventListener("ended", onEnd);
      clearTimeout(t);
    };
  }, [visible]);

  if (!visible) return null;

  const src = theme === "light" ? lightVideo.url : darkVideo.url;

  return (
    <div
      dir="rtl"
      className={`fixed inset-0 z-[9999] overflow-hidden bg-[#07101f] transition-opacity duration-700 ${
        fading ? "opacity-0" : "opacity-100"
      }`}
      role="dialog"
      aria-label="Baeshen Medical Intro"
    >
      {/* Background video, softly integrated */}
      <video
        ref={videoRef}
        src={src}
        poster={poster.url}
        muted={muted}
        playsInline
        autoPlay
        className="absolute inset-0 w-full h-full object-cover opacity-40"
      />

      {/* Ambient wash */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(30,58,95,0.55),rgba(7,16,31,0.95)_70%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#07101f]/60 via-transparent to-[#07101f]/90" />

      {/* Editorial hairline frame */}
      <div className="pointer-events-none absolute inset-6 md:inset-10 border border-[#c9a84c]/15" />
      <div className="pointer-events-none absolute inset-6 md:inset-10 border-t border-[#c9a84c]/40 border-b border-[#c9a84c]/40 mix-blend-screen" style={{ borderLeft: "none", borderRight: "none", height: "1px", top: "50%" }} />

      {/* Top controls */}
      <div className="absolute top-6 md:top-10 inset-x-6 md:inset-x-14 flex justify-between items-center z-20">
        <button
          onClick={() => {
            const v = videoRef.current;
            if (v) {
              v.muted = !v.muted;
              setMuted(v.muted);
            }
          }}
          className="group flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] hover:bg-white/[0.09] backdrop-blur-md px-5 py-2 transition-all duration-500"
          aria-label={muted ? "تشغيل الصوت" : "كتم الصوت"}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#c9a84c] shadow-[0_0_10px_rgba(201,168,76,0.7)] group-hover:scale-125 transition-transform" />
          <span className="text-[10px] tracking-[0.35em] uppercase text-[#e8edf3]/80 font-light">
            {muted ? "تشغيل الصوت" : "كتم"}
          </span>
        </button>

        <button
          onClick={finish}
          className="group flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] hover:bg-white/[0.09] backdrop-blur-md px-5 py-2 transition-all duration-500"
          aria-label="تخطي"
        >
          <span className="text-[10px] tracking-[0.35em] uppercase text-[#e8edf3]/80 font-light">
            تخطي
          </span>
          <svg
            className="w-3 h-3 text-[#e8edf3]/60 group-hover:-translate-x-1 transition-transform rotate-180"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Center brand lockup */}
      <div className="relative z-10 h-full w-full flex flex-col items-center justify-center text-center px-6 animate-fade-in">
        <div className="relative mb-10">
          <div className="absolute -inset-4 rounded-full border border-[#c9a84c]/25 animate-[pulse_4s_ease-in-out_infinite]" />
          <div className="absolute -inset-10 rounded-full border border-[#c9a84c]/10 animate-[pulse_6s_ease-in-out_infinite]" />
          <div className="relative w-40 h-40 md:w-52 md:h-52 rounded-full bg-gradient-to-b from-[#132749] to-[#07101f] p-1 shadow-[0_0_80px_rgba(201,168,76,0.15)]">
            <div className="w-full h-full rounded-full border border-[#c9a84c]/30 bg-[#07101f] flex items-center justify-center overflow-hidden">
              <img
                src={bmcLogo}
                alt="شركة باعشن الطبية"
                className="w-[86%] h-[86%] object-contain drop-shadow-[0_0_18px_rgba(201,168,76,0.15)]"
              />
            </div>
          </div>
        </div>

        <div className="space-y-5 max-w-xl">
          <p className="text-[10px] md:text-xs tracking-[0.55em] uppercase text-[#c9a84c]/80 font-light">
            Baeshen Medical Company
          </p>
          <h1
            className="text-3xl md:text-5xl text-[#e8edf3] leading-tight tracking-wide"
            style={{ fontFamily: '"DM Serif Display", "Instrument Serif", serif' }}
          >
            شركة باعشن الطبية
          </h1>
          <div className="flex items-center justify-center gap-4 pt-2">
            <div className="h-px w-10 bg-gradient-to-l from-transparent to-[#c9a84c]/60" />
            <p className="text-xs md:text-sm text-[#e8edf3]/60 font-light tracking-[0.2em]">
              رعاية طبية موثوقة · تجربة كونسيرج
            </p>
            <div className="h-px w-10 bg-gradient-to-r from-transparent to-[#c9a84c]/60" />
          </div>
        </div>
      </div>

      {/* Bottom loader */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-48 h-px bg-white/5 overflow-hidden">
        <div className="h-full w-1/3 bg-[#c9a84c]/70 animate-[intro-loading_3s_linear_infinite]" />
      </div>

      <style>{`
        @keyframes intro-loading {
          from { transform: translateX(-100%); }
          to { transform: translateX(300%); }
        }
      `}</style>
    </div>
  );
}
