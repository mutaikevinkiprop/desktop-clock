/**
 * Hacker sync palette.
 *
 * SHARED SPEC - in "rotate" mode with the classic preset palette, the active
 * colour is derived from the WALL CLOCK (not process state):
 *
 *     index = floor(Date.now() / 60000) % palette.length
 *
 * Both the clock widget and the wallpaper evaluate this formula, so they flip
 * to the same colour on the same minute boundary without any messaging.
 *
 * Users can also build their OWN rotation sequence (any HEX / RGB / HSL
 * colours) and choose the rotation interval. Custom palettes are independent
 * of the wallpaper.
 *
 * In "fixed" mode the user pins one colour; the wallpaper (loaded with the
 * matching #hash) shows that same colour for the classic preset entries.
 *
 * If you change the preset palette here, change it in the wallpaper's
 * index.html (the `HACKER_PALETTE` constant) too.
 */

import type { HackerPaletteSource } from "../types";
import { clamp, isValidHexColor, normalizeHex } from "./dom";

export interface HackerColour {
  /** Stable id, also used as the wallpaper URL hash (e.g. "#amber"). */
  id: string;
  /** Human-readable name shown in settings. */
  name: string;
  /** Colour applied to the clock text (and rain "head"). */
  text: string;
  /** Dimmed colour for the clock's secondary lines (and rain body). */
  dim: string;
  /** Accent used for highlights / offsets. */
  accent: string;
}

export const HACKER_PALETTE: HackerColour[] = [
  { id: "amber",   name: "Amber",   text: "#ffb000", dim: "#5a3c00", accent: "#ff5a3b" },
  { id: "ice",     name: "Ice",     text: "#5fe0ff", dim: "#0e4d5a", accent: "#ff5a7a" },
  { id: "matrix",  name: "Matrix",  text: "#7dffa0", dim: "#0d6a22", accent: "#ff4d4d" },
  { id: "stealth", name: "Stealth", text: "#1f7a3a", dim: "#0a2a12", accent: "#8a2a2a" },
  { id: "full",    name: "Green",   text: "#33ff66", dim: "#115522", accent: "#ff3b3b" },
];

/** Rotation period in milliseconds (one minute). */
export const HACKER_PERIOD_MS = 60_000;

/** Index of the active palette entry for a given timestamp (rotate mode). */
export function hackerIndexAt(now: number): number {
  return Math.floor(now / HACKER_PERIOD_MS) % HACKER_PALETTE.length;
}

/** The palette entry for a given timestamp (rotate mode, classic preset). */
export function hackerColourAt(now: number): HackerColour {
  return HACKER_PALETTE[hackerIndexAt(now)] ?? HACKER_PALETTE[0]!;
}

/** Look up a palette entry by id, falling back to the first entry. */
export function hackerColourById(id: string): HackerColour {
  return HACKER_PALETTE.find((c) => c.id === id) ?? HACKER_PALETTE[0]!;
}

/** Milliseconds until the next colour change (next minute boundary). */
export function msUntilNextChange(now: number): number {
  return HACKER_PERIOD_MS - (now % HACKER_PERIOD_MS);
}

// ---------------------------------------------------------------------------
// Custom colours: parse + derive a full HackerColour from any user input.
// ---------------------------------------------------------------------------

/** Parse a HEX (#rgb/#rrggbb/#rrggbbaa) or rgb()/hsl() (with/without alpha)
 *  colour string to a normalised `#rrggbb`, or null when unparseable. */
export function parseColorToHex(input: string): string | null {
  const v = input.trim();
  if (isValidHexColor(v)) return normalizeHex(v).slice(0, 7).toLowerCase();

  const fn = v.match(/^(rgb|hsl)a?\(\s*([^)]*)\)$/i);
  if (!fn) return null;
  const parts = fn[2]!
    .split(/[\s,/]+/)
    .filter(Boolean)
    .map((p) => p.replace("%", ""));
  if (parts.length < 3) return null;

  if (fn[1]!.toLowerCase() === "rgb") {
    const r = Math.round(clamp(Number(parts[0]), 0, 255));
    const g = Math.round(clamp(Number(parts[1]), 0, 255));
    const b = Math.round(clamp(Number(parts[2]), 0, 255));
    if ([r, g, b].some((n) => Number.isNaN(n))) return null;
    return (
      "#" +
      [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")
    );
  }

  const h = ((Number(parts[0]) % 360) + 360) % 360;
  const s = clamp(Number(parts[1]), 0, 100) / 100;
  const l = clamp(Number(parts[2]), 0, 100) / 100;
  if ([h, s, l].some((n) => Number.isNaN(n))) return null;
  return hslToHex(h, s, l);
}

function hexToHsl(hex: string): [number, number, number] {
  const h = normalizeHex(hex);
  const r = parseInt(h.slice(1, 3), 16) / 255;
  const g = parseInt(h.slice(3, 5), 16) / 255;
  const b = parseInt(h.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = d / (1 - Math.abs(2 * l - 1));
  let hh: number;
  if (max === r) hh = ((g - b) / d) % 6;
  else if (max === g) hh = (b - r) / d + 2;
  else hh = (r - g) / d + 4;
  return [((hh * 60) + 360) % 360, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  const to = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** A deep, dimmed variant of the colour (for secondary lines). */
export function deriveDimHex(hex: string): string {
  const [h, s, l] = hexToHsl(hex);
  return hslToHex(h, Math.min(1, s * 0.9), Math.max(0.03, l * 0.28));
}

/** A contrasting highlight: hue-shifted and saturated, like the presets. */
export function deriveAccentHex(hex: string): string {
  const [h, , l] = hexToHsl(hex);
  const light = Math.min(0.66, Math.max(0.5, l * 0.95 + 0.1));
  return hslToHex((h - 28 + 360) % 360, 0.85, light);
}

/** Build a full `HackerColour` from a single user colour. */
export function hackerColourFromHex(hex: string): HackerColour {
  const text = (parseColorToHex(hex) ?? "#ffffff").toLowerCase();
  return {
    id: `hex:${text}`,
    name: text,
    text,
    dim: deriveDimHex(text),
    accent: deriveAccentHex(text),
  };
}

/**
 * Resolve the palette in use: the classic presets, or the user's own colour
 * sequence (each entry parsed and derived the same way).
 */
export function hackerPaletteFor(
  source: HackerPaletteSource,
  customColors: string[],
): HackerColour[] {
  if (source === "custom") {
    const colours = customColors
      .map((c) => parseColorToHex(c))
      .filter((c): c is string => !!c)
      .map((c) => hackerColourFromHex(c));
    return colours.length > 0 ? colours : HACKER_PALETTE;
  }
  return HACKER_PALETTE;
}

/** The active palette entry for a timestamp and a custom rotation period. */
export function hackerColourAtIn(
  palette: HackerColour[],
  now: number,
  periodMs: number,
): HackerColour {
  const len = Math.max(1, palette.length);
  const period = Math.max(1_000, periodMs);
  return palette[Math.floor(now / period) % len] ?? palette[0]!;
}

/** Milliseconds until the next change for a custom rotation period. */
export function msUntilNextChangeFor(now: number, periodMs: number): number {
  const period = Math.max(1_000, periodMs);
  return period - (now % period);
}
