/**
 * `useClock` - a hook that always reports the true current time.
 *
 * Accuracy strategy:
 * - We never increment a counter. Each tick reads `Date.now()`.
 * - Ticks are scheduled against the next real boundary (the next second or the
 *   next minute) using a self-correcting timeout, so the clock stays aligned
 *   even after the tab/window was suspended or the machine slept.
 * - We also listen for `visibilitychange`, `focus` and a low-frequency safety
 *   interval (used only while the document is hidden) so the display is
 *   corrected immediately after wake/resume.
 * - A `requestAnimationFrame` nudge for the first ~1.2s after a resume makes
 *   the seconds hand catch up smoothly rather than jumping late.
 */

import { useEffect, useRef, useState } from "react";

/** Re-render frequency: only as often as the UI actually changes. */
export type TickResolution = "second" | "minute";

export function useClock(resolution: TickResolution = "second"): Date {
  const [now, setNow] = useState<Date>(() => new Date());
  const resolutionRef = useRef<TickResolution>(resolution);
  resolutionRef.current = resolution;

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let safety: ReturnType<typeof setInterval> | undefined;
    let raf = 0;
    let cancelled = false;

    const boundary = () =>
      resolutionRef.current === "second"
        ? 1000 - (Date.now() % 1000)
        : 60000 - (Date.now() % 60000);

    const tick = () => {
      if (cancelled) return;
      setNow(new Date());
      // Add a small offset so we land just *after* the boundary rather than
      // potentially just before it (which would produce a double tick).
      timeout = setTimeout(tick, boundary() + 16);
    };

    const resync = () => {
      if (cancelled) return;
      setNow(new Date());
      // Catch-up burst: re-render several times over ~1s after a resume so a
      // skipped second/minute does not linger visually.
      let frames = 0;
      const catchUp = () => {
        if (cancelled) return;
        setNow(new Date());
        if (frames++ < 60) raf = requestAnimationFrame(catchUp);
      };
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(catchUp);
    };

    const start = () => {
      if (timeout) clearTimeout(timeout);
      tick();
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") resync();
    };

    // Timers are throttled while hidden; poll slowly to stay roughly in sync.
    safety = setInterval(() => {
      if (document.visibilityState === "hidden") setNow(new Date());
    }, 15000);

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", resync);
    start();

    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
      if (safety) clearInterval(safety);
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", resync);
    };
  }, []);

  // Re-target scheduling when the resolution changes.
  useEffect(() => {
    resolutionRef.current = resolution;
    setNow(new Date());
  }, [resolution]);

  return now;
}