/**
 * Live preview of the clock, shown inside the settings window.
 *
 * It reuses the real `ClockFace` inside a scaled stage so what the user sees
 * here is exactly what the widget renders. A checkerboard backdrop makes
 * transparency legible.
 */

import { useEffect, useRef, useState } from "react";
import ClockFace from "./ClockFace";
import { useSettings } from "../services/settingsStore";
import { applyThemeVariables } from "../services/themeApply";
import { useClock } from "../utils/useClock";

const STAGE_WIDTH = 620;
const STAGE_HEIGHT = 150;

export default function WidgetPreview() {
  const settings = useSettings((s) => s.settings);
  const stageRef = useRef<HTMLDivElement>(null);
  const faceRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.6);

  const now = useClock(settings.showSeconds ? "second" : "minute");

  // Apply theme variables to a scoped container so the preview matches.
  useEffect(() => {
    if (faceRef.current) applyThemeVariables(settings, faceRef.current);
    // Also set them on the stage so nested tokens resolve.
    if (stageRef.current) applyThemeVariables(settings, stageRef.current);
  }, [settings]);

  // Scale the widget to fit the fixed-height preview stage.
  useEffect(() => {
    const width = settings.widgetSize.width || 520;
    const height = settings.widgetSize.height || 190;
    const targetW = Math.min(STAGE_WIDTH, width * 1.2);
    const targetH = Math.min(STAGE_HEIGHT, height);
    const next = Math.min(targetW / width, targetH / height, 1);
    setScale(next);
  }, [settings.widgetSize.width, settings.widgetSize.height]);

  return (
    <div className="preview-stage" ref={stageRef}>
      <div
        className="preview-clock"
        ref={faceRef}
        style={{
          width: settings.widgetSize.width || 520,
          height: settings.widgetSize.height || 190,
          transform: `scale(${scale})`,
        }}
      >
        <ClockFace settings={settings} now={now} preview />
      </div>
    </div>
  );
}