import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const STORAGE_KEY = "baeshen-theme";

/**
 * Optional light/dark toggle. Reads from localStorage inside useEffect
 * to avoid SSR hydration mismatches. Default = system preference.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);

  useEffect(() => {
    const stored = (typeof window !== "undefined" && window.localStorage.getItem(STORAGE_KEY)) as
      | "light"
      | "dark"
      | null;
    const initial =
      stored ??
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setTheme(initial);
    document.documentElement.classList.toggle("dark", initial === "dark");
  }, []);

  if (!theme) return null;

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore quota */
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "التبديل إلى الوضع الفاتح" : "التبديل إلى الوضع الداكن"}
      className={
        "inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background/60 text-foreground transition hover:border-primary hover:text-primary " +
        (className ?? "")
      }
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
