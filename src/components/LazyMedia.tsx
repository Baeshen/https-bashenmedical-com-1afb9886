import { useEffect, useRef, useState } from "react";

/**
 * Lazy media renderer for the intro overlay.
 *
 * - Uses IntersectionObserver so the browser only starts fetching the
 *   asset when its scene actually reaches the viewport (scenes mount
 *   just-in-time, but this defers the network request even further).
 * - Adds native `loading="lazy"` / `decoding="async"` hints for images.
 * - Uses `preload="none"` on <video> and only sets `src` after intersection,
 *   so no bytes are transferred until the scene is visible.
 */
type LazyImageProps = {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  eager?: boolean;
  onError?: () => void;
};

export function LazyImage({ src, alt, className, width, height, eager, onError }: LazyImageProps) {
  const ref = useRef<HTMLImageElement | null>(null);
  const [ready, setReady] = useState(!!eager);

  useEffect(() => {
    if (eager || ready) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setReady(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setReady(true);
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin: "150px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [eager, ready]);

  return (
    <img
      ref={ref}
      src={ready ? src : undefined}
      alt={alt}
      className={className}
      width={width}
      height={height}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={eager ? "high" : "low"}
      onError={onError}
    />
  );
}

type LazyVideoProps = {
  src: string;
  poster?: string;
  className?: string;
  width?: number;
  height?: number;
};

export function LazyVideo({ src, poster, className, width, height }: LazyVideoProps) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setReady(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setReady(true);
            io.disconnect();
            break;
          }
        }
      },
      { rootMargin: "150px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <video
      ref={ref}
      className={className}
      width={width}
      height={height}
      poster={poster}
      preload={ready ? "metadata" : "none"}
      muted
      playsInline
      autoPlay={ready}
      loop
    >
      {ready ? <source src={src} /> : null}
    </video>
  );
}
