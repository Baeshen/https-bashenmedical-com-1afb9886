// Ultra-light medical motifs overlay: single ECG line + one DNA helix.
// Pure SVG + CSS keyframes, no shadows/blurs/gradients, GPU-friendly transforms.
// Positions use logical properties (start/end) to auto-flip in RTL.
// Fully respects prefers-reduced-motion AND a user toggle (html.reduce-motion):
// animations freeze into a stable, fully-drawn state — no motion, no flicker.
export function MedicalMotifs() {
  return (
    <div
      aria-hidden="true"
      className="motifs pointer-events-none absolute inset-0 overflow-hidden"
    >
      {/* ECG pulse line — full width, bottom */}
      <svg
        className="absolute inset-x-0 bottom-[14%] sm:bottom-[18%] w-full h-12 sm:h-14 opacity-[0.12] text-cyan-200"
        viewBox="0 0 1200 80"
        preserveAspectRatio="none"
        fill="none"
      >
        <path
          className="ecg-path"
          d="M0 40 L280 40 L300 20 L315 60 L330 10 L345 70 L360 40 L720 40 L740 22 L755 58 L770 12 L785 68 L800 40 L1200 40"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {/* DNA helix — desktop only, opposite text side */}
      <svg
        className="hidden md:block absolute top-[10%] end-[6%] lg:end-[8%] w-28 h-44 lg:w-36 lg:h-56 opacity-[0.10] text-white float-y"
        viewBox="0 0 100 200"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      >
        <path d="M20 0 Q50 25 80 50 Q50 75 20 100 Q50 125 80 150 Q50 175 20 200" />
        <path d="M80 0 Q50 25 20 50 Q50 75 80 100 Q50 125 20 150 Q50 175 80 200" />
      </svg>

      {/* Single medical cross — desktop only */}
      <svg
        className="hidden lg:block absolute top-[60%] end-[16%] w-10 h-10 opacity-[0.10] text-cyan-100 float-y"
        viewBox="0 0 40 40"
        fill="currentColor"
      >
        <path d="M16 4h8v12h12v8H24v12h-8V24H4v-8h12z" />
      </svg>

      <style>{`
        @keyframes ecg-draw {
          0% { stroke-dashoffset: 2400; }
          60% { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: -2400; }
        }
        @keyframes float-y {
          0%, 100% { transform: translate3d(0,0,0); }
          50% { transform: translate3d(0,-8px,0); }
        }
        .ecg-path {
          stroke-dasharray: 2400;
          stroke-dashoffset: 2400;
          animation: ecg-draw 10s linear infinite;
        }
        .float-y {
          animation: float-y 9s ease-in-out infinite;
          will-change: transform;
        }

        /* Freeze into a stable, fully-drawn state — no partial frames. */
        @media (prefers-reduced-motion: reduce) {
          .motifs .ecg-path { animation: none !important; stroke-dashoffset: 0 !important; }
          .motifs .float-y { animation: none !important; transform: none !important; will-change: auto; }
        }
        html.reduce-motion .motifs .ecg-path { animation: none !important; stroke-dashoffset: 0 !important; }
        html.reduce-motion .motifs .float-y { animation: none !important; transform: none !important; will-change: auto; }
      `}</style>
    </div>
  );
}
