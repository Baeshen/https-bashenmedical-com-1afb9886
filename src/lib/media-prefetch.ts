/**
 * Prefetch helpers for scene-linked media.
 *
 * The intro is time-driven, so instead of relying on IntersectionObserver
 * (which never fires for scenes that are only mounted momentarily) we
 * schedule prefetches during browser idle time, ~1.5s before each scene
 * starts. Images use `new Image()` to warm the HTTP cache; videos use
 * `<link rel="prefetch">` since browsers won't fetch a <source> tag until
 * a <video> mounts.
 */

type IdleHandle = number;
type IdleDeadline = { didTimeout: boolean; timeRemaining: () => number };

const w = typeof window !== "undefined" ? window : undefined;

const scheduleIdle = (cb: (d: IdleDeadline) => void): IdleHandle => {
  if (!w) return 0;
  const ric = (w as unknown as { requestIdleCallback?: (cb: (d: IdleDeadline) => void, o?: { timeout: number }) => number })
    .requestIdleCallback;
  if (typeof ric === "function") return ric(cb, { timeout: 800 });
  return w.setTimeout(() => cb({ didTimeout: true, timeRemaining: () => 0 }), 100) as unknown as number;
};

const prefetched = new Set<string>();

function prefetchOne(url: string, kind: "image" | "video") {
  if (!w || !url || prefetched.has(url)) return;
  prefetched.add(url);
  try {
    if (kind === "image") {
      const img = new Image();
      img.decoding = "async";
      (img as HTMLImageElement & { fetchPriority?: string }).fetchPriority = "low";
      img.src = url;
    } else {
      const link = document.createElement("link");
      link.rel = "prefetch";
      link.as = "video";
      link.href = url;
      document.head.appendChild(link);
    }
  } catch {
    /* prefetch is best-effort */
  }
}

export function prefetchMedia(urls: Array<{ url: string; kind: "image" | "video" }>) {
  if (!urls.length) return;
  scheduleIdle(() => {
    for (const u of urls) prefetchOne(u.url, u.kind);
  });
}
