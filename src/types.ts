/**
 * Central type definitions for the whole application.
 *
 * Everything persisted lives in `Settings`. Adding a field requires a default
 * in `settings/defaults.ts` so that corrupted or older settings files load
 * cleanly.
 */

export type TimeFormat = "12" | "24";

/** Colour sync behaviour: off, a single pinned colour, or a rotating palette. */
export type ColorSyncMode = "off" | "fixed" | "rotate";

/** Which colour set the colour sync uses. */
export type ColorPaletteSource = "preset" | "custom";

/** Which data drives the contribution grid. */
export type ContributionSource = "simulated" | "github";

/**
 * The floating contribution widget: a GitHub-style contribution heatmap that
 * lives on the desktop as its own fixed, non-resizable band spanning the full
 * width of its monitor (horizontally centered, vertically centered), rendered
 * over a fully transparent background with the squares flush against the
 * left and right edges of the window.
 */
export interface ContributionSettings {
  /** Show the floating contribution widget. */
  enabled: boolean;
  /** Where the contribution data comes from. */
  source: ContributionSource;
  /** GitHub username when `source` is "github"; also shown as the headline
   *  profile label, e.g. "@mutaikevinkiprop", for either source. */
  username: string;
  /** Draw the dim "off" squares as well as the lit ones. */
  grid: boolean;
  /** Auto-play the flashing sweep across the grid. */
  animate: boolean;
  /** Sweep speed, 1 (slow) .. 10 (fast). */
  speed: number;
  /** Show the headline (total + streak) above the grid. */
  headline: boolean;
}

/** "custom" = user-dragged spot, "center" = exact screen center, "top" = top edge, horizontally centered. */
export type PositionMode = "custom" | "center" | "top";

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
  /** Gentle breathing glow + scale pulse that makes the clock stand out. */
  pulseEnabled: boolean;

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
  /** Last known custom position in PHYSICAL px (virtual-desktop coordinates,
   *  uniform across monitors regardless of each display's scale factor).
   *  Settings v1 stored logical px; those are converted on restore. */
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

  // --- Colour sync ---------------------------------------------------------
  /**
   * Colour-sync mode:
   *   "off"     - use the user's own colours (no palette override).
   *   "fixed"   - pin ONE colour (a preset entry or a custom colour),
   *               no rotation.
   *   "rotate"  - cycle the palette on a timer (`colorRotateSeconds`).
   */
  colorSyncMode: ColorSyncMode;
  /** Palette id to pin when colorSyncMode is "fixed" and source is "preset". */
  colorFixedId: string;
  /** "preset" = the classic palette; "custom" = the user's own
   *  colour sequence (`colorCustomColors`). */
  colorPaletteSource: ColorPaletteSource;
  /** User-defined rotation colours (normalised `#rrggbb` values). */
  colorCustomColors: string[];
  /** Pinned colour when colorSyncMode is "fixed" and source is "custom". */
  colorFixedColor: string;
  /** Rotation interval in seconds (10..300). */
  colorRotateSeconds: number;
  /** Floating contribution-widget settings. */
  contributions: ContributionSettings;

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