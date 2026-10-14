/**
 * Position settings: monitor selection, custom vs. centered placement,
 * manual centering, reset, and multi-monitor diagnostics.
 */

import { useEffect, useState } from "react";
import { useSettings } from "../../services/settingsStore";
import { Panel, RadioGroup, Row, Section, Slider, Toggle } from "../../components/Controls";
import * as native from "../../services/native";
import type { MonitorInfo, MonitorTarget, PositionMode } from "../../types";

const NUMBER_WORDS = [
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
  "twenty",
];

/** "Primary" for the primary display; "Secondary one/two/…" for the rest. */
function monitorLabel(monitors: MonitorInfo[], m: MonitorInfo): string {
  if (m.isPrimary) return "Primary";
  const position = monitors
    .filter((x) => !x.isPrimary)
    .findIndex((x) => x.index === m.index);
  if (position >= 0) {
    return `Secondary ${NUMBER_WORDS[position] ?? String(position + 1)}`;
  }
  return `Monitor ${m.index + 1}`;
}

export default function PositionSection() {
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);
  const monitors = useSettings((s) => s.monitors);
  const refreshMonitors = useSettings((s) => s.refreshMonitors);
  const positionNow = useSettings((s) => s.positionNow);

  const [status, setStatus] = useState<string>("");

  // Refresh the monitor list whenever this section is opened.
  useEffect(() => {
    void refreshMonitors();
  }, [refreshMonitors]);

  const handleApply = async () => {
    setStatus("Applying position…");
    await positionNow();
    setStatus(
      settings.positionMode === "top"
        ? "Aligned to the top center of the selected monitor."
        : "Centered on the selected monitor.",
    );
    window.setTimeout(() => setStatus(""), 2600);
  };

  const handleReset = async () => {
    update({ positionMode: "center", savedPosition: null });
    await native.centerWindow(settings.monitor);
    setStatus("Position reset and re-centered.");
    window.setTimeout(() => setStatus(""), 2600);
  };

  return (
    <>
      <Section title="Monitor">
        <Panel>
          <Row
            title="Target monitor"
            description="Where the clock is placed, and which display centering uses."
          >
            <select
              className="ui-select"
              aria-label="Target monitor"
              value={settings.monitor}
              onChange={(e) => {
                const value = e.target.value as MonitorTarget;
                update({ monitor: value });
                if (settings.positionMode === "center") {
                  void native.centerWindow(value);
                } else if (settings.positionMode === "top") {
                  void native.alignTopWindow(value);
                }
              }}
            >
              <option value="primary">Primary Monitor</option>
              <option value="current">Current Monitor</option>
              {monitors.map((m, index) => (
                <option key={m.index} value={`index:${index}`}>
                  {monitorLabel(monitors, m)}
                </option>
              ))}
            </select>
          </Row>

          <Row
            title="Position mode"
            description="Centered keeps the clock at the screen center; top center pins it to the top edge. Both follow the widget size automatically."
          >
            <RadioGroup<PositionMode>
              name="positionMode"
              value={settings.positionMode}
              options={[
                { value: "custom", label: "Custom" },
                { value: "center", label: "Center of screen" },
                { value: "top", label: "Top center" },
              ]}
              onChange={(value) => {
                update({ positionMode: value });
                if (value === "center") void native.centerWindow(settings.monitor);
                if (value === "top") void native.alignTopWindow(settings.monitor);
              }}
            />
          </Row>

          <Row
            title="Center on startup"
            description="On launch, place the clock at its preset spot (center or top center) on the selected display."
          >
            <Toggle
              checked={settings.centerOnStartup}
              label="Center on startup"
              onChange={(checked) => update({ centerOnStartup: checked })}
            />
          </Row>
        </Panel>
      </Section>

      <Section title="Actions">
        <Panel>
          <Row
            title="Apply position"
            description="Move the clock to the preset spot right away (center or top center)."
          >
            <button className="ui-button ui-button--primary" onClick={() => void handleApply()}>
              {settings.positionMode === "top" ? "Align Top Center" : "Center Clock Now"}
            </button>
          </Row>
          <Row title="Reset position" description="Return to centered placement and clear the saved spot.">
            <button className="ui-button" onClick={() => void handleReset()}>
              Reset Position
            </button>
          </Row>
          <Row title="Refresh monitors" description="Re-scan connected displays.">
            <button className="ui-button" onClick={() => void refreshMonitors()}>
              Refresh
            </button>
          </Row>
        </Panel>
      </Section>

      <Section title="Detected displays">
        <Panel>
          {monitors.length === 0 ? (
            <Row title="No display information" description="Monitor data is available only in the desktop app.">
              <span />
            </Row>
          ) : (
            monitors.map((m) => (
              <Row key={m.index} title={monitorLabel(monitors, m)}>
                <span />
              </Row>
            ))
          )}
        </Panel>
      </Section>

      <Section title="Widget size">
        <Panel>
          <Row title="Width" description="Widget width in pixels." htmlFor="widgetWidth">
            <Slider
              id="widgetWidth"
              label="Widget width"
              value={settings.widgetSize.width}
              min={200}
              max={1400}
              step={10}
              onChange={(value) =>
                update({ widgetSize: { ...settings.widgetSize, width: value } })
              }
              format={(v) => `${v}px`}
            />
          </Row>
          <Row title="Height" description="Widget height in pixels." htmlFor="widgetHeight">
            <Slider
              id="widgetHeight"
              label="Widget height"
              value={settings.widgetSize.height}
              min={90}
              max={900}
              step={10}
              onChange={(value) =>
                update({ widgetSize: { ...settings.widgetSize, height: value } })
              }
              format={(v) => `${v}px`}
            />
          </Row>
        </Panel>
      </Section>

      {status && (
        <p
          role="status"
          aria-live="polite"
          style={{ fontSize: 12.5, color: "var(--ui-accent)", marginTop: 4 }}
        >
          {status}
        </p>
      )}
    </>
  );
}