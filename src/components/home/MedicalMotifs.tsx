// Subtle floating medical motifs overlay: DNA, ECG line, and medical cross.
// Pure SVG + CSS animations. Non-interactive, low-opacity, respects reduced motion.
export function MedicalMotifs() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden [mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_78%)] motion-reduce:[&_*]:!animate-none"
    >
      {/* ECG pulse line — bottom */}
      <svg
        className="absolute inset-x-0 bottom-[18%] w-full h-16 opacity-[0.14] text-cyan-200"
        viewBox="0 0 1200 80"
        preserveAspectRatio="none"
        fill="none"
      >
        <path
          d="M0 40 L220 40 L245 40 L260 20 L275 60 L290 10 L305 70 L320 40 L560 40 L585 40 L600 22 L615 58 L630 12 L645 68 L660 40 L900 40 L925 40 L940 24 L955 56 L970 14 L985 66 L1000 40 L1200 40"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            strokeDasharray: 2400,
            strokeDashoffset: 2400,
            animation: "ecg-draw 9s linear infinite",
          }}
        />
      </svg>

      {/* DNA helix — top-right */}
      <svg
        className="absolute top-[8%] end-[6%] w-40 h-64 opacity-[0.10] text-white float-slow"
        viewBox="0 0 100 200"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      >
        <path d="M20 0 Q50 25 80 50 Q50 75 20 100 Q50 125 80 150 Q50 175 20 200" />
        <path d="M80 0 Q50 25 20 50 Q50 75 80 100 Q50 125 20 150 Q50 175 80 200" />
        {Array.from({ length: 9 }).map((_, i) => {
          const y = 10 + i * 22;
          return <line key={i} x1="26" y1={y} x2="74" y2={y} strokeOpacity="0.7" />;
        })}
      </svg>

      {/* Medical cross — mid-left */}
      <svg
        className="absolute top-[42%] start-[7%] w-14 h-14 opacity-[0.10] text-cyan-100 float-slower"
        viewBox="0 0 40 40"
        fill="currentColor"
      >
        <path d="M16 4h8v12h12v8H24v12h-8V24H4v-8h12z" />
      </svg>

      {/* Small floating dots (molecules) */}
      <div className="absolute top-[22%] start-[38%] w-1.5 h-1.5 rounded-full bg-cyan-200/40 float-slow" />
      <div className="absolute top-[68%] start-[22%] w-1 h-1 rounded-full bg-white/30 float-slower" />
      <div className="absolute top-[30%] end-[28%] w-1 h-1 rounded-full bg-cyan-200/40 float-slow" />

      <style>{`
        @keyframes ecg-draw {
          0% { stroke-dashoffset: 2400; }
          60% { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: -2400; }
        }
        @keyframes float-y {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .float-slow { animation: float-y 7s ease-in-out infinite; }
        .float-slower { animation: float-y 11s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
