import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Wraps skeletons, an error fallback, and real content — cross-fading between
 * the three states in a single DOM slot. Skeleton block sizes intentionally
 * mirror the real layout so the swap is dimensionally stable.
 *
 * State precedence: error → loading → content.
 * When `error` is provided, we render the fallback even if `loading` is still
 * true — prevents a stuck skeleton when a query keeps retrying on a permanent
 * failure (e.g. Supabase 401 in test environments).
 */
export function SkeletonSwap({
  loading,
  error,
  skeleton,
  errorFallback,
  children,
}: {
  loading: boolean;
  error?: unknown;
  skeleton: ReactNode;
  errorFallback?: ReactNode;
  children: ReactNode;
}) {
  const state: "error" | "skeleton" | "content" = error
    ? "error"
    : loading
      ? "skeleton"
      : "content";
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={state}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        {state === "error" ? errorFallback ?? <SectionError /> : null}
        {state === "skeleton" ? skeleton : null}
        {state === "content" ? children : null}
      </motion.div>
    </AnimatePresence>
  );
}

/** Default error fallback for a home section (Supabase 401 / network). */
export function SectionError({
  title,
  hint,
  onRetry,
  retryLabel,
}: {
  title?: string;
  hint?: string;
  onRetry?: () => void;
  retryLabel?: string;
} = {}) {
  return (
    <div
      role="alert"
      aria-live="polite"
      className="glass-fut flex flex-col items-center justify-center gap-3 p-8 text-center"
    >
      <div className="grid h-11 w-11 place-items-center rounded-xl border border-[var(--fut-border-strong)] bg-white/[0.04] text-[color:var(--neon-teal)]">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <div className="text-sm font-semibold text-[color:var(--fut-ink)]">
        {title ?? "تعذّر تحميل البيانات"}
      </div>
      <div className="max-w-sm text-xs text-[color:var(--fut-ink-muted)]">
        {hint ?? "حدث خطأ مؤقت أثناء الاتصال بالخادم. يمكنك إعادة المحاولة."}
      </div>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 inline-flex items-center gap-2 rounded-full border border-[var(--fut-border)] bg-white/[0.04] px-4 py-2 text-xs font-semibold text-[color:var(--fut-ink)] transition hover:border-[var(--neon-teal)]"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {retryLabel ?? "إعادة المحاولة"}
        </button>
      ) : null}
    </div>
  );
}

/**
 * Specialties grid — matches the real card in index.tsx:
 *   glass-fut p-5 · icon 44×44 (h-11 w-11 rounded-xl) · title text-sm (~20px)
 *   · description text-xs line-clamp-2 (~32px).
 */
export function SpecialtiesSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass-fut p-5">
          <div className="skeleton-neon h-11 w-11 rounded-xl" />
          <div className="skeleton-neon mt-3 h-4 w-3/4 rounded" />
          <div className="mt-1 space-y-1.5">
            <div className="skeleton-neon h-3 w-full rounded" />
            <div className="skeleton-neon h-3 w-4/5 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Featured doctors grid — matches the real card:
 *   glass-fut flex-col items-center p-6 · avatar 96×96 rounded-full ·
 *   mt-4 name + mt-1 title · mt-4 button (btn-magnetic !py-2 text-xs ≈ h-8 full-width rounded-full).
 */
export function DoctorsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass-fut flex flex-col items-center p-6 text-center">
          <div className="skeleton-neon h-24 w-24 rounded-full" />
          <div className="skeleton-neon mt-4 h-4 w-2/3 rounded" />
          <div className="skeleton-neon mt-1 h-3 w-1/2 rounded" />
          <div className="skeleton-neon mt-4 h-8 w-full rounded-full" />
        </div>
      ))}
    </div>
  );
}

/**
 * Announcements grid — matches AnnouncementsSection card:
 *   glass-fut p-6 · badge pill (h-6) + date (h-3) · mt-5 title text-xl (~28px)
 *   · mt-2 3-line description · mt-auto+pt-6 CTA button (~h-9 rounded-full ~40 wide).
 * Using flex + a spacer keeps the CTA pinned to the bottom like the real card.
 */
export function AnnouncementsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass-fut flex h-full flex-col p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="skeleton-neon h-6 w-28 rounded-full" />
            <div className="skeleton-neon h-3 w-20 rounded" />
          </div>
          <div className="skeleton-neon mt-5 h-6 w-4/5 rounded" />
          <div className="mt-2 space-y-2">
            <div className="skeleton-neon h-3 w-full rounded" />
            <div className="skeleton-neon h-3 w-11/12 rounded" />
            <div className="skeleton-neon h-3 w-3/4 rounded" />
          </div>
          <div className="mt-auto pt-6">
            <div className="skeleton-neon h-9 w-40 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
