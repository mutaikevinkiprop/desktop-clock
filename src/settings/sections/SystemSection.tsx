/**
 * System settings: launch at startup, tray behaviour and the global shortcut.
 */

import { useEffect, useState } from "react";
import { useSettings } from "../../services/settingsStore";
import { Panel, Row, Section, Toggle } from "../../components/Controls";
import ShortcutCapture from "../../components/ShortcutCapture";
import * as native from "../../services/native";

export default function SystemSection() {
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState("");
  const [autostartActual, setAutostartActual] = useState<boolean | null>(null);

  // Read the real OS autostart state so we surface any mismatch.
  useEffect(() => {
    void native.getAutostart().then(setAutostartActual);
  }, [settings.autostart]);

  const applyShortcut = async (accelerator: string | null) => {
    setError("");
    const ok = await native.setGlobalShortcut(accelerator);
    if (accelerator && !ok) {
      setError(
        `Could not register "${accelerator}". Another application may already use it.`,
      );
      return false;
    }
    update({ shortcut: accelerator ?? settings.shortcut, shortcutEnabled: !!accelerator });
    return true;
  };

  return (
    <>
      <Section title="Windows startup">
        <Panel>
          <Row
            title="Start with Windows"
            description="Launch the clock automatically when you sign in."
          >
            <Toggle
              checked={settings.autostart}
              label="Start with Windows"
              onChange={async (checked) => {
                const actual = await native.setAutostart(checked);
                update({ autostart: actual });
                setAutostartActual(actual);
              }}
            />
          </Row>
          {autostartActual !== null && autostartActual !== settings.autostart && (
            <Row
              title="State mismatch detected"
              description={`Windows reports autostart is ${autostartActual ? "enabled" : "disabled"}. Click to resynchronise.`}
            >
              <button
                className="ui-button"
                onClick={async () => {
                  const actual = await native.setAutostart(settings.autostart);
                  setAutostartActual(actual);
                }}
              >
                Resync
              </button>
            </Row>
          )}
        </Panel>
      </Section>

      <Section title="Global shortcut">
        <Panel>
          <Row
            title="Enable shortcut"
            description="Press the shortcut anywhere to center the clock instantly."
          >
            <Toggle
              checked={settings.shortcutEnabled}
              label="Enable global shortcut"
              onChange={(checked) => {
                void applyShortcut(checked ? settings.shortcut : null);
              }}
            />
          </Row>
          <Row title="Shortcut" description="Click to record a new key combination.">
            <button className="ui-button" onClick={() => setCapturing(true)}>
              {settings.shortcut || "Not set"}
            </button>
          </Row>
          <Row
            title="Centering target"
            description="Which display the shortcut centers the clock on."
          >
            <select
              className="ui-select"
              aria-label="Shortcut centering target"
              value={settings.shortcutTarget}
              onChange={(e) => {
                update({ shortcutTarget: e.target.value });
                void native.setGlobalShortcut(settings.shortcutEnabled ? settings.shortcut : null);
              }}
            >
              <option value="primary">Primary monitor</option>
              <option value="current">Current monitor</option>
              <option value="auto">Automatic</option>
            </select>
          </Row>
        </Panel>
        {error && (
          <p role="alert" style={{ fontSize: 12, color: "#ff8f8f", marginTop: 10 }}>
            {error}
          </p>
        )}
      </Section>

      <Section title="System tray">
        <Panel>
          <Row
            title="Tray icon"
            description="Click the tray icon to show or hide the clock. Right-click for more options."
          >
            <span style={{ fontSize: 12, color: "var(--ui-text-dim)" }}>
              Always available
            </span>
          </Row>
        </Panel>
      </Section>

      {capturing && (
        <ShortcutCapture
          onCancel={() => setCapturing(false)}
          onCapture={async (accelerator) => {
            setCapturing(false);
            await applyShortcut(accelerator);
          }}
        />
      )}
    </>
  );
}