/**
 * Default settings + robust (de)serialisation.
 *
 * Every value that reaches the app passes through `sanitizeSettings`, which
 * guarantees a fully valid `Settings` object even when the stored JSON is
 * corrupted, truncated, hand-edited, or written by an older version.
 */

import type { ContributionSettings, HackerMode, HackerPaletteSource, Settings, ThemeId, TimeFormat, TimezoneClock } from "../types";
import { getTheme } from "../themes";
import { detectLocalZone, detectSystemTimeFormat, isValidTimeZone, zoneToLabel } from "../utils/time";
import { clamp, isValidHexColor, normalizeHex, num, oneOf, str, uid } from "../utils/dom";

export const SETTINGS_VERSION = 2;
export const STORE_FILE = "settings.json";
export const STORE_KEY = "settings";

const THEME_IDS: readonly ThemeId[] = [
  "minimal-dark",
  "minimal-light",
  "amoled",
  "glass",
  "cyber",
  "retro",
  "custom",
];

/** Widget default size in logical pixels. */
export const DEFAULT_WIDGET_SIZE = { width: 520, height: 204 };

/** Build a fresh, fully-populated default settings object. */
export function createDefaultSettings(): Settings {
  const zone = detectLocalZone();
  const format: TimeFormat = detectSystemTimeFormat();

  const settings: Settings = {
    // Clock
    timeFormat: format,
    autoFormat: true,
    showSeconds: true,
    showAmPm: format === "12",
    showDate: true,
    showDay: true,
    compactDate: false,

    // Appearance
    theme: "minimal-dark",
    backgroundColor: "#10131a",
    textColor: "#f5f7fa",
    accentColor: "#5b8cff",
    opacity: 0,
    blur: 0,
    cornerRadius: 0,
    padding: 0,
    borderEnabled: false,
    borderColor: "#ffffff",
    borderWidth: 0,
    shadowEnabled: true,
    shadowStrength: 0,
    glowEnabled: true,
    glowStrength: 48,
    pulseEnabled: true,

    // Typography
    fontFamily: "system-sans",
    fontSize: 72,
    fontWeight: 600,
    letterSpacing: -1,
    lineHeight: 1.05,

    // Timezones
    clocks: [],

    // Position
    monitor: "primary",
    positionMode: "top",
    centerOnStartup: true,
    savedPosition: null,

    // Widget
    alwaysOnTop: false,
    clickThrough: true,
    resizable: true,
    draggable: true,
    showShadow: true,
    widgetSize: { ...DEFAULT_WIDGET_SIZE },
    widgetVisible: true,

    // Hacker sync
    hackerMode: "fixed",
    hackerSync: false,
    hackerFixedId: "full",
    hackerPaletteSource: "preset",
    hackerCustomColors: ["#ffb000", "#5fe0ff", "#7dffa0"],
    hackerFixedColor: "#ffb000",
    hackerRotateSeconds: 10,

    // Floating contribution widget (GitHub-style heatmap)
    contributions: {
      enabled: true,
      source: "simulated",
      username: "",
      grid: true,
      animate: true,
      speed: 7,
      headline: true,
    },

    // System
    autostart: true,
    shortcutEnabled: true,
    shortcut: "Ctrl+Alt+KeyC",
    shortcutTarget: "primary",

    // Meta
    version: SETTINGS_VERSION,
    localZone: zone,
  };

  return settings;
}

/** Sanitise an arbitrary clock entry. */
function sanitizeClock(raw: unknown, index: number): TimezoneClock | null {
  if (raw === null || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const zone = str(obj.zone, "");
  if (!isValidTimeZone(zone)) return null;
  return {
    id: str(obj.id, `clock-${index}`),
    zone,
    label: str(obj.label, zoneToLabel(zone)).toUpperCase(),
    visible: typeof obj.visible === "boolean" ? obj.visible : true,
  };
}

/** Sanitise the floating contribution-widget settings. */
function sanitizeContributions(
  raw: unknown,
  fallback: ContributionSettings,
): ContributionSettings {
  if (raw === null || typeof raw !== "object") return { ...fallback };
  const obj = raw as Record<string, unknown>;
  const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
  const source: ContributionSettings["source"] =
    obj.source === "github" ? "github" : "simulated";
  const username =
    typeof obj.username === "string" ? obj.username.trim().slice(0, 39) : fallback.username;

  return {
    enabled: bool(obj.enabled, fallback.enabled),
    source,
    username,
    grid: bool(obj.grid, fallback.grid),
    animate: bool(obj.animate, fallback.animate),
    speed: Math.round(clamp(num(obj.speed, fallback.speed), 1, 10)),
    headline: bool(obj.headline, fallback.headline),
  };
}

/** Sanitise the user's custom hacker colour sequence (normalised hex). */
function sanitizeHackerColors(raw: unknown, fallback: string[]): string[] {
  if (!Array.isArray(raw)) return [...fallback];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string" || !isValidHexColor(item)) continue;
    const hex = normalizeHex(item).slice(0, 7).toLowerCase();
    if (seen.has(hex)) continue;
    seen.add(hex);
    out.push(hex);
    if (out.length >= 12) break;
  }
  return out.length > 0 ? out : [...fallback];
}

/**
 * Coerce any input into a valid `Settings` object, filling missing/invalid
 * fields from the defaults. Never throws.
 */
export function sanitizeSettings(raw: unknown): Settings {
  const defaults = createDefaultSettings();
  if (raw === null || typeof raw !== "object") return defaults;
  const input = raw as Record<string, unknown>;

  const clampNum = (v: unknown, fallback: number, min: number, max: number) =>
    clamp(num(v, fallback), min, max);

  const theme = oneOf<ThemeId>(input.theme, THEME_IDS, defaults.theme);

  const color = (v: unknown, fallback: string) =>
    typeof v === "string" && isValidHexColor(v) ? v : fallback;

  // Clocks: accept arrays, drop invalid entries, guarantee unique ids.
  let clocks: TimezoneClock[] = [];
  if (Array.isArray(input.clocks)) {
    const seen = new Set<string>();
    clocks = input.clocks
      .map((c, i) => sanitizeClock(c, i))
      .filter((c): c is TimezoneClock => c !== null)
      .map((c) => {
        let id = c.id;
        while (seen.has(id)) id = uid("clock");
        seen.add(id);
        return { ...c, id };
      });
  }

  const sizeRaw = input.widgetSize as Record<string, unknown> | undefined;
  const widgetSize = {
    width: clampNum(sizeRaw?.width, defaults.widgetSize.width, 200, 4000),
    height: clampNum(sizeRaw?.height, defaults.widgetSize.height, 90, 3000),
  };

  let savedPosition: Settings["savedPosition"] = null;
  const posRaw = input.savedPosition as Record<string, unknown> | undefined;
  if (posRaw && typeof posRaw === "object") {
    const x = num(posRaw.x, Number.NaN);
    const y = num(posRaw.y, Number.NaN);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      savedPosition = { x: Math.round(x), y: Math.round(y) };
    }
  }

  const shortcut = str(input.shortcut, defaults.shortcut);
  const hasShortcut = /^(Ctrl|Alt|Shift|Super|Command|Cmd)/i.test(shortcut);

  const settings: Settings = {
    timeFormat: oneOf<TimeFormat>(input.timeFormat, ["12", "24"], defaults.timeFormat),
    autoFormat: typeof input.autoFormat === "boolean" ? input.autoFormat : defaults.autoFormat,
    showSeconds: typeof input.showSeconds === "boolean" ? input.showSeconds : defaults.showSeconds,
    showAmPm: typeof input.showAmPm === "boolean" ? input.showAmPm : defaults.showAmPm,
    showDate: typeof input.showDate === "boolean" ? input.showDate : defaults.showDate,
    showDay: typeof input.showDay === "boolean" ? input.showDay : defaults.showDay,
    compactDate: typeof input.compactDate === "boolean" ? input.compactDate : defaults.compactDate,

    theme,
    backgroundColor: color(input.backgroundColor, defaults.backgroundColor),
    textColor: color(input.textColor, defaults.textColor),
    accentColor: color(input.accentColor, defaults.accentColor),
    opacity: clampNum(input.opacity, defaults.opacity, 0, 100),
    blur: clampNum(input.blur, defaults.blur, 0, 40),
    cornerRadius: clampNum(input.cornerRadius, defaults.cornerRadius, 0, 64),
    padding: clampNum(input.padding, defaults.padding, 0, 80),
    borderEnabled:
      typeof input.borderEnabled === "boolean" ? input.borderEnabled : defaults.borderEnabled,
    borderColor: color(input.borderColor, defaults.borderColor),
    borderWidth: clampNum(input.borderWidth, defaults.borderWidth, 0, 8),
    shadowEnabled:
      typeof input.shadowEnabled === "boolean" ? input.shadowEnabled : defaults.shadowEnabled,
    shadowStrength: clampNum(input.shadowStrength, defaults.shadowStrength, 0, 100),
    glowEnabled:
      typeof input.glowEnabled === "boolean" ? input.glowEnabled : defaults.glowEnabled,
    glowStrength: clampNum(input.glowStrength, defaults.glowStrength, 0, 100),
    pulseEnabled:
      typeof input.pulseEnabled === "boolean" ? input.pulseEnabled : defaults.pulseEnabled,

    fontFamily: str(input.fontFamily, defaults.fontFamily),
    fontSize: clampNum(input.fontSize, defaults.fontSize, 14, 400),
    fontWeight: clampNum(input.fontWeight, defaults.fontWeight, 100, 900),
    letterSpacing: clampNum(input.letterSpacing, defaults.letterSpacing, -10, 40),
    lineHeight: clampNum(input.lineHeight, defaults.lineHeight, 0.8, 3),

    clocks,

    monitor: str(input.monitor, defaults.monitor),
    positionMode: oneOf<Settings["positionMode"]>(
      input.positionMode,
      ["custom", "center", "top"],
      defaults.positionMode,
    ),
    centerOnStartup:
      typeof input.centerOnStartup === "boolean" ? input.centerOnStartup : defaults.centerOnStartup,
    savedPosition,

    alwaysOnTop:
      typeof input.alwaysOnTop === "boolean" ? input.alwaysOnTop : defaults.alwaysOnTop,
    clickThrough:
      typeof input.clickThrough === "boolean" ? input.clickThrough : defaults.clickThrough,
    resizable: typeof input.resizable === "boolean" ? input.resizable : defaults.resizable,
    draggable: typeof input.draggable === "boolean" ? input.draggable : defaults.draggable,
    showShadow:
      typeof input.showShadow === "boolean" ? input.showShadow : defaults.showShadow,
    widgetSize,
    widgetVisible:
      typeof input.widgetVisible === "boolean" ? input.widgetVisible : defaults.widgetVisible,

    hackerMode: oneOf<HackerMode>(
      input.hackerMode,
      ["off", "fixed", "rotate"],
      // Migrate the old boolean: hackerSync:true used to mean "rotate".
      typeof input.hackerSync === "boolean"
        ? input.hackerSync
          ? "rotate"
          : "off"
        : defaults.hackerMode,
    ),
    hackerSync: false, // derived below from hackerMode
    hackerFixedId: str(input.hackerFixedId, defaults.hackerFixedId),
    hackerPaletteSource: oneOf<HackerPaletteSource>(
      input.hackerPaletteSource,
      ["preset", "custom"],
      defaults.hackerPaletteSource,
    ),
    hackerCustomColors: sanitizeHackerColors(
      input.hackerCustomColors,
      defaults.hackerCustomColors,
    ),
    hackerFixedColor: color(input.hackerFixedColor, defaults.hackerFixedColor),
    hackerRotateSeconds: Math.round(
      clampNum(input.hackerRotateSeconds, defaults.hackerRotateSeconds, 10, 300),
    ),

    contributions: sanitizeContributions(
      input.contributions ?? input.wallpaper,
      defaults.contributions,
    ),

    autostart: typeof input.autostart === "boolean" ? input.autostart : defaults.autostart,
    shortcutEnabled:
      typeof input.shortcutEnabled === "boolean" ? input.shortcutEnabled : defaults.shortcutEnabled,
    shortcut: hasShortcut ? shortcut : defaults.shortcut,
    shortcutTarget: str(input.shortcutTarget, defaults.shortcutTarget),

    // Preserve the STORED version so startup can migrate v1 saved positions
    // (logical px) to physical px. The version is bumped on the next persist.
    version: typeof input.version === "number" && Number.isFinite(input.version)
      ? Math.max(1, Math.floor(input.version))
      : 1,
    localZone: isValidTimeZone(str(input.localZone, "")) ? str(input.localZone, "") : defaults.localZone,
  };

  // Keep the legacy `hackerSync` boolean mirrored to the new mode.
  settings.hackerSync = settings.hackerMode === "rotate";

  // If the user selected a theme preset but the stored theme is "custom",
  // re-detect so the picker highlights the correct preset.
  if (settings.theme === "custom") {
    const detected = detectThemePreset(settings);
    if (detected) settings.theme = detected;
  }

  return settings;
}

/** Return a preset id if the settings exactly match one, otherwise null. */
function detectThemePreset(settings: Settings): ThemeId | null {
  const candidates: ThemeId[] = [
    "minimal-dark",
    "minimal-light",
    "amoled",
    "glass",
    "cyber",
    "retro",
  ];
  for (const id of candidates) {
    const theme = getTheme(id);
    if (!theme) continue;
    const matches = Object.entries(theme.values).every(([key, value]) => {
      return (settings as unknown as Record<string, unknown>)[key] === value;
    });
    if (matches) return id;
  }
  return null;
}

/** Apply a theme preset by merging its values into the current settings. */
export function applyThemeValues(settings: Settings, themeId: ThemeId): Settings {
  const theme = getTheme(themeId);
  if (!theme) {
    return { ...settings, theme: themeId };
  }
  return {
    ...settings,
    ...theme.values,
    theme: themeId,
  };
}