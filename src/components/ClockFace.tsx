/**
 * The desktop clock face.
 *
 * Renders the large time, the date line and any additional time-zone clocks.
 * Everything is derived from the live `now` value supplied by `useClock`.
 */

import { useMemo } from "react";
import type { Settings } from "../types";
import {
  formatClock,
  formatDateLine,
  formatZoneTime,
  getTimeParts,
  zoneOffsetLabel,
} from "../utils/time";

interface ClockFaceProps {
  settings: Settings;
  now: Date;
  /** When true, the face is scaled down for the settings preview. */
  preview?: boolean;
}

export default function ClockFace({ settings, now, preview = false }: ClockFaceProps) {
  const parts = useMemo(
    () => getTimeParts(now, settings.timeFormat, settings.showSeconds, settings.showAmPm),
    // `now` changes every tick by design; the other values are settings.
    [now, settings.timeFormat, settings.showSeconds, settings.showAmPm],
  );

  const time = formatClock(parts, settings.showSeconds);
  const dateLine = formatDateLine(parts, settings, preview);

  const visibleZones = settings.clocks.filter((c) => c.visible);

  return (
    <div
      className="clock-face"
      data-glow={settings.glowEnabled ? "true" : "false"}
      data-preview={preview ? "true" : "false"}
    >
      <div className="clock-content">
        <div className="clock-time" aria-label="Current time">
          <span className="clock-time__main" aria-hidden="true">
            {parts.hours}:{parts.minutes}
          </span>
          {settings.showSeconds && parts.seconds && (
            <span className="clock-time__seconds" aria-hidden="true">
              {parts.seconds}
            </span>
          )}
          {parts.meridiem && (
            <span className="clock-time__meridiem">{parts.meridiem}</span>
          )}
        </div>

        {dateLine && (
          <div className="clock-date" aria-label="Date">
            {dateLine}
          </div>
        )}

        {visibleZones.length > 0 && (
          <div className="clock-zones" aria-label="Other time zones">
            {visibleZones.map((clock) => {
              const zoned = formatZoneTime(
                now,
                clock.zone,
                settings.timeFormat,
                false,
              );
              const offset = zoneOffsetLabel(now, clock.zone);
              return (
                <div className="clock-zone" key={clock.id}>
                  <span className="clock-zone__label">{clock.label}</span>
                  <span className="clock-zone__time">{zoned.time}</span>
                  {offset && offset !== "SAME" && (
                    <span className="clock-zone__offset">{offset}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Screen-reader friendly announcement of the full time, updated slowly. */}
      <time
        className="sr-only"
        dateTime={now.toISOString()}
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          overflow: "hidden",
          clip: "rect(0 0 0 0)",
          whiteSpace: "nowrap",
        }}
      >
        {time}
      </time>
    </div>
  );
}