/**
 * About section: version information and privacy statement.
 */

import { useSettings } from "../../services/settingsStore";
import Logo from "../../components/Logo";

const APP_VERSION = "1.0.0";

export default function AboutSection() {
  const settings = useSettings((s) => s.settings);

  return (
    <>
      <div className="about-card">
        <Logo className="about-mark" size={62} idSuffix="about" />
        <div>
          <h2>Desktop Clock</h2>
          <p>
            A lightweight, elegant desktop clock widget for Windows. Built with
            Tauri, Rust and React. Everything runs locally: no accounts, no
            telemetry, and no network requests of any kind.
          </p>
          <div className="about-meta">
            <span className="about-chip">Version {APP_VERSION}</span>
            <span className="about-chip">Tauri 2</span>
            <span className="about-chip">Rust</span>
            <span className="about-chip">React + TypeScript</span>
            <span className="about-chip">Offline-first</span>
          </div>
        </div>
      </div>

      <section className="settings-section" style={{ marginTop: 24 }}>
        <h2 className="settings-section__title">Environment</h2>
        <div className="settings-panel">
          <div className="settings-row">
            <div className="settings-row__label">
              <strong>Local time zone</strong>
              <span>Detected from the operating system.</span>
            </div>
            <span style={{ fontSize: 12.5, color: "var(--ui-text-dim)" }}>
              {settings.localZone}
            </span>
          </div>
          <div className="settings-row">
            <div className="settings-row__label">
              <strong>Additional clocks</strong>
              <span>Time zones currently configured.</span>
            </div>
            <span style={{ fontSize: 12.5, color: "var(--ui-text-dim)" }}>
              {settings.clocks.length}
            </span>
          </div>
          <div className="settings-row">
            <div className="settings-row__label">
              <strong>Settings file</strong>
              <span>Stored privately in your Windows app-data folder.</span>
            </div>
            <span style={{ fontSize: 12.5, color: "var(--ui-text-dim)" }}>
              settings.json
            </span>
          </div>
        </div>
      </section>

      <section className="settings-section">
        <h2 className="settings-section__title">Privacy</h2>
        <div className="settings-panel">
          <div className="settings-row">
            <div className="settings-row__label">
              <strong>No data collection</strong>
              <span>
                This application never collects personal information, never
                tracks usage and never contacts a server.
              </span>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}