import { useEffect, useState } from "react";
import { Sparkles, SparklesIcon } from "lucide-react";

const STORAGE_KEY = "reduce-motion";

function readInitial(): boolean {
  if (typeof window === "undefined") return false;
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === "1") return true;
  if (saved === "0") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/**
 * Small floating toggle to enable/disable non-essential animations.
 * Persists in localStorage and adds `reduce-motion` class on <html>,
 * which MedicalMotifs (and any future component) honors alongside the
 * system-level prefers-reduced-motion media query.
 */
export function MotionToggle() {
  const [reduced, setReduced] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const initial = readInitial();
    setReduced(initial);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const html = document.documentElement;
    html.classList.toggle("reduce-motion", reduced);
    window.localStorage.setItem(STORAGE_KEY, reduced ? "1" : "0");
  }, [reduced, hydrated]);

  if (!hydrated) return null;

  return (
    <button
      type="button"
      onClick={() => setReduced((v) => !v)}
      aria-pressed={reduced}
      aria-label={reduced ? "تفعيل الرسوم المتحركة" : "تقليل الرسوم المتحركة"}
      title={reduced ? "تفعيل الرسوم المتحركة" : "تقليل الرسوم المتحركة"}
      className="fixed bottom-4 start-4 z-40 inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background/80 text-foreground shadow-sm backdrop-blur-md hover:bg-background transition-colors"
    >
      {reduced ? <SparklesIcon className="h-4 w-4 opacity-50" /> : <Sparkles className="h-4 w-4" />}
    </button>
  );
}
