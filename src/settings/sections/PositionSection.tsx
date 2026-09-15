/**
 * Position settings: monitor selection, custom vs. centered placement,
 * manual centering, reset, and multi-monitor diagnostics.
 */

import { useEffect, useState } from "react";
import { useSettings } from "../../services/settingsStore";
import { Panel, RadioGroup, Row, Section, Slider, Toggle } from "../../components/Controls";
import * as native from "../../services/native";
import type { MonitorTarget, PositionMode } from "../../types";

export default function PositionSection() {
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);
  const monitors = useSettings((s) => s.monitors);
  const refreshMonitors = useSettings((s) => s.refreshMonitors);
  const centerNow = useSettings((s) => s.centerNow);

  const [status, setStatus] = useState<string>("");

  // Refresh the monitor list whenever this section is opened.
  useEffect(() => {
    void refreshMonitors();
  }, [refreshMonitors]);

  const describeMonitor = (index: number, isPrimary: boolean) => {
    const m = monitors[index];
    if (!m) return `Monitor ${index + 1}`;
    const name = m.isPrimary ? "Primary" : m.name ?? `Monitor ${index + 1}`;
    const label = isPrimary && !m.isPrimary ? `${name} (primary)` : name;
    return `${label} — ${m.width}×${m.height} @ ${Math.round(m.scaleFactor * 100)}%`;
  };

  const handleCenter = async () => {
    setStatus("Centering…");
    await centerNow();
    setStatus("Centered on the selected monitor.");
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
                }
              }}
            >
              <option value="primary">Primary Monitor</option>
              <option value="current">Current Monitor</option>
              {monitors.map((m, index) => (
                <option key={m.index} value={`index:${index}`}>
                  {m.name ?? `Monitor ${index + 1}`} — {m.width}×{m.height} @{" "}
                  {Math.round(m.scaleFactor * 100)}%
                  {m.isPrimary ? " (primary)" : ""}
                </option>
              ))}
            </select>
          </Row>

          <Row
            title="Position mode"
            description="Centered mode keeps the clock perfectly centered, even after resizing."
          >
            <RadioGroup<PositionMode>
              name="positionMode"
              value={settings.positionMode}
              options={[
                { value: "custom", label: "Custom" },
                { value: "center", label: "Center of screen" },
              ]}
              onChange={(value) => {
                update({ positionMode: value });
                if (value === "center") void native.centerWindow(settings.monitor);
              }}
            />
          </Row>

          <Row
            title="Center on startup"
            description="On launch, place the clock at the center of the selected display."
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
          <Row title="Center Clock Now" description="Move the clock to the exact center right away.">
            <button className="ui-button ui-button--primary" onClick={() => void handleCenter()}>
              Center Clock Now
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
            monitors.map((m, index) => (
              <Row
                key={m.index}
                title={describeMonitor(index, m.isPrimary)}
                description={`Origin (${m.x}, ${m.y}) · work area handled automatically`}
              >
                <span style={{ fontSize: 12, color: "var(--ui-text-dim)" }}>
                  {m.isPrimary ? "Primary" : "Secondary"}
                </span>
              </Row>
            ))
          )}
        </Panel>
      </Section>

      <Section title="Widget size">
        <Panel>
          <Row title="Width" htmlFor="widgetWidth">
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
          <Row title="Height" htmlFor="widgetHeight">
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