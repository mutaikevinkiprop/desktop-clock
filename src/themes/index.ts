/**
 * Built-in theme definitions.
 *
 * A theme is a partial set of appearance + typography settings. Applying a
 * theme merges these values into the user's settings, so users can further
 * tweak any individual property afterwards ("custom" is derived from that).
 */

import type { Settings, ThemeId } from "../types";

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  description: string;
  /** Preview swatch colours: [background, text, accent]. */
  swatch: [string, string, string];
  /** Whether this theme is best on a light desktop. */
  lightSurface: boolean;
  values: Partial<Settings>;
}

export const THEMES: ThemeDefinition[] = [
  {
    id: "minimal-dark",
    name: "Minimal Dark",
    description: "Large light clock on a translucent dark panel.",
    swatch: ["#10131a", "#f5f7fa", "#5b8cff"],
    lightSurface: false,
    values: {
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
      fontFamily: "system-sans",
      fontWeight: 600,
      letterSpacing: -1,
      lineHeight: 1.05,
    },
  },
  {
    id: "minimal-light",
    name: "Minimal Light",
    description: "Dark text on a clean light panel.",
    swatch: ["#f7f8fa", "#14161a", "#3b6cff"],
    lightSurface: true,
    values: {
      backgroundColor: "#f7f8fa",
      textColor: "#14161a",
      accentColor: "#3b6cff",
      opacity: 92,
      blur: 8,
      cornerRadius: 20,
      padding: 26,
      borderEnabled: true,
      borderColor: "#000000",
      borderWidth: 1,
      shadowEnabled: true,
      shadowStrength: 28,
      glowEnabled: false,
      glowStrength: 20,
      fontFamily: "system-sans",
      fontWeight: 600,
      letterSpacing: -1,
      lineHeight: 1.05,
    },
  },
  {
    id: "amoled",
    name: "AMOLED",
    description: "Pure black background with bright clock text.",
    swatch: ["#000000", "#ffffff", "#00e0ff"],
    lightSurface: false,
    values: {
      backgroundColor: "#000000",
      textColor: "#ffffff",
      accentColor: "#00e0ff",
      opacity: 100,
      blur: 0,
      cornerRadius: 16,
      padding: 24,
      borderEnabled: false,
      borderColor: "#1a1a1a",
      borderWidth: 1,
      shadowEnabled: false,
      shadowStrength: 0,
      glowEnabled: false,
      glowStrength: 30,
      fontFamily: "jetbrains-mono",
      fontWeight: 700,
      letterSpacing: 0,
      lineHeight: 1.05,
    },
  },
  {
    id: "glass",
    name: "Glass",
    description: "Frosted, semi-transparent glass panel with blur.",
    swatch: ["#ffffff", "#0b0f16", "#7aa2ff"],
    lightSurface: false,
    values: {
      backgroundColor: "#ffffff",
      textColor: "#0b0f16",
      accentColor: "#7aa2ff",
      opacity: 18,
      blur: 28,
      cornerRadius: 26,
      padding: 28,
      borderEnabled: true,
      borderColor: "#ffffff",
      borderWidth: 1,
      shadowEnabled: true,
      shadowStrength: 35,
      glowEnabled: false,
      glowStrength: 20,
      fontFamily: "inter",
      fontWeight: 600,
      letterSpacing: -1.5,
      lineHeight: 1.05,
    },
  },
  {
    id: "cyber",
    name: "Cyber",
    description: "Futuristic monospace clock with a digital glow.",
    swatch: ["#04070d", "#39ff9e", "#39ff9e"],
    lightSurface: false,
    values: {
      backgroundColor: "#04070d",
      textColor: "#39ff9e",
      accentColor: "#39ff9e",
      opacity: 88,
      blur: 6,
      cornerRadius: 12,
      padding: 26,
      borderEnabled: true,
      borderColor: "#39ff9e",
      borderWidth: 1,
      shadowEnabled: true,
      shadowStrength: 40,
      glowEnabled: true,
      glowStrength: 70,
      fontFamily: "orbitron",
      fontWeight: 700,
      letterSpacing: 2,
      lineHeight: 1.1,
    },
  },
  {
    id: "retro",
    name: "Retro",
    description: "Classic digital alarm-clock look.",
    swatch: ["#1a0f05", "#ff9d4d", "#ff6b1a"],
    lightSurface: false,
    values: {
      backgroundColor: "#1a0f05",
      textColor: "#ff9d4d",
      accentColor: "#ff6b1a",
      opacity: 94,
      blur: 0,
      cornerRadius: 10,
      padding: 24,
      borderEnabled: true,
      borderColor: "#ff6b1a",
      borderWidth: 2,
      shadowEnabled: true,
      shadowStrength: 30,
      glowEnabled: true,
      glowStrength: 45,
      fontFamily: "digital",
      fontWeight: 400,
      letterSpacing: 1,
      lineHeight: 1.1,
    },
  },
];

export function getTheme(id: ThemeId): ThemeDefinition | undefined {
  return THEMES.find((t) => t.id === id);
}

/**
 * Determine which built-in theme (if any) the current settings still match.
 * Returns "custom" when the user has diverged from every preset.
 */
export function detectTheme(settings: Settings): ThemeId {
  for (const theme of THEMES) {
    const matches = Object.entries(theme.values).every(([key, value]) => {
      return (settings as unknown as Record<string, unknown>)[key] === value;
    });
    if (matches) return theme.id;
  }
  return "custom";
}