/**
 * Central type definitions for the whole application.
 *
 * Everything persisted lives in `Settings`. Adding a field requires a default
 * in `settings/defaults.ts` so that corrupted or older settings files load
 * cleanly.
 */

export type TimeFormat = "12" | "24";

export type PositionMode = "custom" | "center";

/** Monitor selector. `primary`, `current`, or `index:N` (N = monitor index). */
export type MonitorTarget = string;

export type ThemeId =
  | "minimal-dark"
  | "minimal-light"
  | "amoled"
  | "glass"
  | "cyber"
  | "retro"
  | "custom";

export interface TimezoneClock {
  id: string;
  /** IANA identifier, e.g. "Africa/Nairobi". */
  zone: string;
  /** User-visible label; defaults to the city/region name. */
  label: string;
  visible: boolean;
}

export interface Settings {
  // --- Clock ---------------------------------------------------------------
  timeFormat: TimeFormat;
  /** True when the format was detected from the OS and the user hasn't overridden it. */
  autoFormat: boolean;
  showSeconds: boolean;
  showAmPm: boolean;
  showDate: boolean;
  showDay: boolean;
  /** Show a compact date when the widget is narrow. */
  compactDate: boolean;

  // --- Appearance ----------------------------------------------------------
  theme: ThemeId;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  opacity: number; // 0..100
  blur: number; // 0..40 px (glass effect strength)
  cornerRadius: number; // px
  padding: number; // px
  borderEnabled: boolean;
  borderColor: string;
  borderWidth: number; // px
  shadowEnabled: boolean;
  shadowStrength: number; // 0..100
  glowEnabled: boolean;
  glowStrength: number; // 0..100

  // --- Typography ----------------------------------------------------------
  fontFamily: string;
  fontSize: number; // px (base clock size)
  fontWeight: number; // 100..900
  letterSpacing: number; // px
  lineHeight: number; // multiplier

  // --- Timezones -----------------------------------------------------------
  clocks: TimezoneClock[];

  // --- Position ------------------------------------------------------------
  monitor: MonitorTarget;
  positionMode: PositionMode;
  centerOnStartup: boolean;
  /** Last known custom position (logical px, virtual-desktop coords). */
  savedPosition: { x: number; y: number } | null;

  // --- Widget window -------------------------------------------------------
  alwaysOnTop: boolean;
  clickThrough: boolean;
  resizable: boolean;
  draggable: boolean;
  showShadow: boolean;
  /** Window size in logical px. */
  widgetSize: { width: number; height: number };
  widgetVisible: boolean;

  // --- System --------------------------------------------------------------
  autostart: boolean;
  shortcutEnabled: boolean;
  /** Tauri accelerator string, e.g. "Ctrl+Alt+KeyC". */
  shortcut: string;
  shortcutTarget: MonitorTarget;

  // --- Meta ----------------------------------------------------------------
  /** Schema version, used for future migrations. */
  version: number;
  /** Local time zone detected on first launch. */
  localZone: string;
}

export interface MonitorInfo {
  index: number;
  name: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  scaleFactor: number;
  isPrimary: boolean;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type WidgetWindow = "widget" | "settings";