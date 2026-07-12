import { motion, AnimatePresence } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Wraps skeletons and real content, cross-fading between them.
 * Renders {loading ? skeleton : children} — same DOM slot for both.
 */
export function SkeletonSwap({
  loading,
  skeleton,
  children,
}: {
  loading: boolean;
  skeleton: ReactNode;
  children: ReactNode;
}) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={loading ? "skeleton" : "content"}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        {loading ? skeleton : children}
      </motion.div>
    </AnimatePresence>
  );
}

export function SpecialtiesSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass-fut p-5 space-y-3">
          <div className="skeleton-neon h-11 w-11 rounded-xl" />
          <div className="skeleton-neon h-3 w-2/3 rounded" />
          <div className="skeleton-neon h-3 w-4/5 rounded" />
          <div className="skeleton-neon h-3 w-1/2 rounded" />
        </div>
      ))}
    </div>
  );
}

export function DoctorsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass-fut flex flex-col items-center p-6 text-center">
          <div className="skeleton-neon h-24 w-24 rounded-full" />
          <div className="skeleton-neon mt-4 h-4 w-3/4 rounded" />
          <div className="skeleton-neon mt-2 h-3 w-1/2 rounded" />
          <div className="skeleton-neon mt-5 h-9 w-full rounded-full" />
        </div>
      ))}
    </div>
  );
}
