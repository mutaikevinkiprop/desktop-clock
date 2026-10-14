/**
 * `useHackerSync` - returns the hacker palette colour that should be applied
 * right now, or null when hacker sync is off.
 *
 * Fully customisable:
 *   - "rotate": cycles through the active palette (classic presets or the
 *     user's own colour sequence) every `hackerRotateSeconds` seconds. With
 *     the preset palette at 60s the flip stays aligned to the wall clock, so
 *     it changes at the same instant as the wallpaper.
 *   - "fixed" : a single pinned colour (a preset entry, or one of the user's
 *     custom colours); never changes.
 */

import { useEffect, useRef, useState } from "react";
import {
  hackerColourAtIn,
  hackerColourById,
  hackerColourFromHex,
  hackerPaletteFor,
  msUntilNextChangeFor,
  type HackerColour,
} from "./hackerPalette";
import type { HackerMode, HackerPaletteSource } from "../types";

export interface HackerSyncConfig {
  hackerMode: HackerMode;
  hackerPaletteSource: HackerPaletteSource;
  hackerCustomColors: string[];
  hackerFixedId: string;
  hackerFixedColor: string;
  hackerRotateSeconds: number;
}

export function useHackerSync(config: HackerSyncConfig): HackerColour | null {
  const {
    hackerMode: mode,
    hackerPaletteSource: source,
    hackerCustomColors: customColors,
    hackerFixedId: fixedId,
    hackerFixedColor: fixedColor,
    hackerRotateSeconds: rotateSeconds,
  } = config;

  const palette = hackerPaletteFor(source, customColors);
  const periodMs = Math.max(1_000, (rotateSeconds || 60) * 1_000);
  const active = mode !== "off";

  const compute = (): HackerColour | null => {
    if (!active) return null;
    if (mode === "fixed") {
      return source === "custom"
        ? hackerColourFromHex(fixedColor || palette[0]!.text)
        : hackerColourById(fixedId);
    }
    return hackerColourAtIn(palette, Date.now(), periodMs);
  };

  const [colour, setColour] = useState<HackerColour | null>(compute);
  const computeRef = useRef(compute);
  computeRef.current = compute;

  // Recompute immediately whenever any part of the configuration changes.
  useEffect(() => {
    setColour(compute());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, source, fixedId, fixedColor, rotateSeconds, customColors]);

  useEffect(() => {
    if (mode !== "rotate") return; // only rotate mode needs a timer
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      const now = Date.now();
      setColour(computeRef.current());
      // Land just after the boundary to avoid a double fire.
      timeout = setTimeout(tick, msUntilNextChangeFor(now, periodMs) + 20);
    };

    const resync = () => {
      if (cancelled) return;
      setColour(computeRef.current());
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") resync();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", resync);

    tick();

    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", resync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, periodMs, customColors, source]);

  return colour;
}
