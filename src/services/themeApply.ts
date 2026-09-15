/**
 * Applies the current `Settings` to the document as CSS custom properties and
 * theme attributes. Doing this in one place keeps the widget and the settings
 * preview perfectly consistent.
 */

import type { Settings } from "../types";
import { getFontStack } from "../themes/fonts";
import { hexToRgba, clamp } from "../utils/dom";

export function applyThemeVariables(settings: Settings, root: HTMLElement): void {
  const opacity = clamp(settings.opacity, 0, 100) / 100;
  const shadowAlpha = clamp(settings.shadowStrength, 0, 100) / 100;
  const glowAlpha = clamp(settings.glowStrength, 0, 100) / 100;
  const borderAlpha = 0.35;

  const shadowY = Math.round(10 * shadowAlpha) + 4;
  const shadowBlur = Math.round(20 + 40 * shadowAlpha);

  root.style.setProperty("--clock-bg", hexToRgba(settings.backgroundColor, opacity));
  root.style.setProperty("--clock-bg-solid", settings.backgroundColor);
  root.style.setProperty("--clock-text", settings.textColor);
  root.style.setProperty("--clock-accent", settings.accentColor);
  root.style.setProperty("--clock-text-dim", hexToRgba(settings.textColor, 0.6));
  root.style.setProperty("--clock-text-faint", hexToRgba(settings.textColor, 0.4));
  root.style.setProperty(
    "--clock-border",
    settings.borderEnabled ? hexToRgba(settings.borderColor, borderAlpha) : "transparent",
  );
  root.style.setProperty("--clock-border-width", `${settings.borderWidth}px`);
  root.style.setProperty("--clock-radius", `${settings.cornerRadius}px`);
  root.style.setProperty("--clock-padding", `${settings.padding}px`);
  root.style.setProperty("--clock-blur", `${settings.blur}px`);

  root.style.setProperty(
    "--clock-shadow",
    settings.shadowEnabled && settings.showShadow
      ? `0 ${shadowY}px ${shadowBlur}px rgba(0, 0, 0, ${0.45 * shadowAlpha})`
      : "none",
  );
  root.style.setProperty(
    "--clock-glow",
    settings.glowEnabled ? `0 0 ${Math.round(6 + 24 * glowAlpha)}px ${hexToRgba(settings.textColor, 0.55 * glowAlpha)}` : "none",
  );

  root.style.setProperty("--clock-font", getFontStack(settings.fontFamily));
  root.style.setProperty("--clock-size", `${settings.fontSize}px`);
  root.style.setProperty("--clock-weight", String(settings.fontWeight));
  root.style.setProperty("--clock-tracking", `${settings.letterSpacing}px`);
  root.style.setProperty("--clock-line-height", String(settings.lineHeight));
  root.style.setProperty("--clock-accent-glow", hexToRgba(settings.accentColor, 0.5));

  root.dataset.theme = settings.theme;
  root.dataset.transparent = settings.opacity < 100 ? "true" : "false";
}