/**
 * Default settings + robust (de)serialisation.
 *
 * Every value that reaches the app passes through `sanitizeSettings`, which
 * guarantees a fully valid `Settings` object even when the stored JSON is
 * corrupted, truncated, hand-edited, or written by an older version.
 */

import type { Settings, ThemeId, TimeFormat, TimezoneClock } from "../types";
import { getTheme } from "../themes";
import { detectLocalZone, detectSystemTimeFormat, isValidTimeZone, zoneToLabel } from "../utils/time";
import { clamp, isValidHexColor, num, oneOf, str, uid } from "../utils/dom";

export const SETTINGS_VERSION = 1;
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
export const DEFAULT_WIDGET_SIZE = { width: 520, height: 190 };

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
    opacity: 78,
    blur: 12,
    cornerRadius: 22,
    padding: 26,
    borderEnabled: true,
    borderColor: "#ffffff",
    borderWidth: 1,
    shadowEnabled: true,
    shadowStrength: 45,
    glowEnabled: false,
    glowStrength: 25,

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
    positionMode: "center",
    centerOnStartup: true,
    savedPosition: null,

    // Widget
    alwaysOnTop: false,
    clickThrough: false,
    resizable: true,
    draggable: true,
    showShadow: true,
    widgetSize: { ...DEFAULT_WIDGET_SIZE },
    widgetVisible: true,

    // System
    autostart: false,
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

    fontFamily: str(input.fontFamily, defaults.fontFamily),
    fontSize: clampNum(input.fontSize, defaults.fontSize, 14, 400),
    fontWeight: clampNum(input.fontWeight, defaults.fontWeight, 100, 900),
    letterSpacing: clampNum(input.letterSpacing, defaults.letterSpacing, -10, 40),
    lineHeight: clampNum(input.lineHeight, defaults.lineHeight, 0.8, 3),

    clocks,

    monitor: str(input.monitor, defaults.monitor),
    positionMode: oneOf<Settings["positionMode"]>(
      input.positionMode,
      ["custom", "center"],
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

    autostart: typeof input.autostart === "boolean" ? input.autostart : defaults.autostart,
    shortcutEnabled:
      typeof input.shortcutEnabled === "boolean" ? input.shortcutEnabled : defaults.shortcutEnabled,
    shortcut: hasShortcut ? shortcut : defaults.shortcut,
    shortcutTarget: str(input.shortcutTarget, defaults.shortcutTarget),

    version: SETTINGS_VERSION,
    localZone: isValidTimeZone(str(input.localZone, "")) ? str(input.localZone, "") : defaults.localZone,
  };

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