/**
 * `useColorSync` - returns the sync palette colour that should be applied
 * right now, or null when colour sync is off.
 *
 * Fully customisable:
 *   - "rotate": cycles through the active palette (classic presets or the
 *     user's own colour sequence) every `colorRotateSeconds` seconds. With
 *     the preset palette at 60s the flip stays aligned to the wall clock, so
 *     the clock and the contribution grid change at the same instant.
 *   - "fixed" : a single pinned colour (a preset entry, or one of the user's
 *     custom colours); never changes.
 */

import { useEffect, useRef, useState } from "react";
import {
  colorAtIn,
  classicColorById,
  colorFromHex,
  paletteFor,
  msUntilNextChangeFor,
  type PaletteColor,
} from "./colorPalette";
import type { ColorSyncMode, ColorPaletteSource } from "../types";

export interface ColorSyncConfig {
  colorSyncMode: ColorSyncMode;
  colorPaletteSource: ColorPaletteSource;
  colorCustomColors: string[];
  colorFixedId: string;
  colorFixedColor: string;
  colorRotateSeconds: number;
}

export function useColorSync(config: ColorSyncConfig): PaletteColor | null {
  const {
    colorSyncMode: mode,
    colorPaletteSource: source,
    colorCustomColors: customColors,
    colorFixedId: fixedId,
    colorFixedColor: fixedColor,
    colorRotateSeconds: rotateSeconds,
  } = config;

  const palette = paletteFor(source, customColors);
  const periodMs = Math.max(1_000, (rotateSeconds || 60) * 1_000);
  const active = mode !== "off";

  const compute = (): PaletteColor | null => {
    if (!active) return null;
    if (mode === "fixed") {
      return source === "custom"
        ? colorFromHex(fixedColor || palette[0]!.text)
        : classicColorById(fixedId);
    }
    return colorAtIn(palette, Date.now(), periodMs);
  };

  const [colour, setColour] = useState<PaletteColor | null>(compute);
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
