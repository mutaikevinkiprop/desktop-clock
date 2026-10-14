/**
 * `useEffectiveThemeColors` - the single source of truth for the colours the
 * desktop widgets render with.
 *
 * The clock and the contribution grid both derive their colours from this
 * hook, so they can never diverge:
 *
 *   - hacker mode "fixed" / "rotate" -> the active palette entry's colours
 *     (the classic presets or the user's own custom colour sequence),
 *   - hacker mode "off"               -> the user's own theme colours.
 *
 * Mirrors the effective-colour computation previously inlined in
 * `ClockWidget`, now shared by both widgets.
 */

import { useSettings } from "../services/settingsStore";
import { useHackerSync } from "./useHackerSync";

export interface EffectiveThemeColors {
  /** The primary colour (clock digits / grid squares). */
  textColor: string;
  /** The secondary highlight colour. */
  accentColor: string;
}

export function useEffectiveThemeColors(): EffectiveThemeColors {
  const settings = useSettings((s) => s.settings);
  const hackerColour = useHackerSync({
    hackerMode: settings.hackerMode,
    hackerPaletteSource: settings.hackerPaletteSource,
    hackerCustomColors: settings.hackerCustomColors,
    hackerFixedId: settings.hackerFixedId,
    hackerFixedColor: settings.hackerFixedColor,
    hackerRotateSeconds: settings.hackerRotateSeconds,
  });

  if (hackerColour) {
    return { textColor: hackerColour.text, accentColor: hackerColour.accent };
  }
  return { textColor: settings.textColor, accentColor: settings.accentColor };
}
