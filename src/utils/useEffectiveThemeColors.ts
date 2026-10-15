/**
 * `useEffectiveThemeColors` - the single source of truth for the colours the
 * desktop widgets render with.
 *
 * The clock and the contribution grid both derive their colours from this
 * hook, so they can never diverge:
 *
 *   - colour-sync mode "fixed" / "rotate" -> the active palette entry's
 *     colours (the classic presets or the user's own custom sequence),
 *   - colour-sync mode "off"             -> the user's own theme colours.
 *
 * Mirrors the effective-colour computation previously inlined in
 * `ClockWidget`, now shared by both widgets.
 */

import { useSettings } from "../services/settingsStore";
import { useColorSync } from "./useColorSync";

export interface EffectiveThemeColors {
  /** The primary colour (clock digits / grid squares). */
  textColor: string;
  /** The secondary highlight colour. */
  accentColor: string;
}

export function useEffectiveThemeColors(): EffectiveThemeColors {
  const settings = useSettings((s) => s.settings);
  const syncColor = useColorSync({
    colorSyncMode: settings.colorSyncMode,
    colorPaletteSource: settings.colorPaletteSource,
    colorCustomColors: settings.colorCustomColors,
    colorFixedId: settings.colorFixedId,
    colorFixedColor: settings.colorFixedColor,
    colorRotateSeconds: settings.colorRotateSeconds,
  });

  if (syncColor) {
    return { textColor: syncColor.text, accentColor: syncColor.accent };
  }
  return { textColor: settings.textColor, accentColor: settings.accentColor };
}
