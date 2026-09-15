/**
 * Small, dependency-free helpers used across the app.
 */

/** Colours stored as `#RRGGBB` or `#RRGGBBAA`. */
export function isValidHexColor(value: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(
    value.trim(),
  );
}

/** Normalise a hex colour, expanding shorthand and dropping alpha. */
export function normalizeHex(value: string): string {
  const v = value.trim();
  if (!isValidHexColor(v)) return "#000000";
  if (v.length === 4) {
    return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  }
  if (v.length === 5) {
    return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}${v[4]}${v[4]}`;
  }
  return v.slice(0, 7);
}

/** Convert `#RRGGBB` to `rgba(r, g, b, a)`. */
export function hexToRgba(hex: string, alpha: number): string {
  const h = normalizeHex(hex);
  const r = parseInt(h.slice(1, 3), 16);
  const g = parseInt(h.slice(3, 5), 16);
  const b = parseInt(h.slice(5, 7), 16);
  const a = clamp(alpha, 0, 1);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** Return `#RRGGBB` with the given alpha appended as `#RRGGBBAA`. */
export function withAlpha(hex: string, alpha: number): string {
  const h = normalizeHex(hex);
  const a = Math.round(clamp(alpha, 0, 1) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${h}${a}`;
}

/** Perceived luminance, used for contrast decisions. */
export function luminance(hex: string): number {
  const h = normalizeHex(hex);
  const r = parseInt(h.slice(1, 3), 16) / 255;
  const g = parseInt(h.slice(3, 5), 16) / 255;
  const b = parseInt(h.slice(5, 7), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function isLight(hex: string): boolean {
  return luminance(hex) > 0.5;
}

export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** Coerce an unknown value to a finite number, or return the fallback. */
export function num(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function str(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

export function oneOf<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return typeof value === "string" && (options as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

/** Generate a reasonably unique id without external dependencies. */
export function uid(prefix = "id"): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${rand}`;
}

export function debounce<T extends (...args: never[]) => void>(fn: T, wait: number) {
  let handle: ReturnType<typeof setTimeout> | undefined;
  return (...args: Parameters<T>) => {
    if (handle) clearTimeout(handle);
    handle = setTimeout(() => fn(...args), wait);
  };
}

export function throttle<T extends (...args: never[]) => void>(fn: T, wait: number) {
  let last = 0;
  let pending: ReturnType<typeof setTimeout> | undefined;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    const remaining = wait - (now - last);
    if (remaining <= 0) {
      last = now;
      fn(...args);
    } else if (!pending) {
      pending = setTimeout(() => {
        last = Date.now();
        pending = undefined;
        fn(...args);
      }, remaining);
    }
  };
}

export function deepMerge<T>(base: T, override: unknown): T {
  if (override === null || typeof override !== "object" || Array.isArray(override)) {
    return (override === undefined ? base : (override as T));
  }
  if (typeof base !== "object" || base === null || Array.isArray(base)) {
    return override as T;
  }
  const result: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(override as Record<string, unknown>)) {
    const current = (base as Record<string, unknown>)[key];
    result[key] = deepMerge(current, value);
  }
  return result as T;
}

/** SSR/WebView-safe clamp of a DOM measurement. */
export function px(value: number): string {
  return `${Math.round(value)}px`;
}