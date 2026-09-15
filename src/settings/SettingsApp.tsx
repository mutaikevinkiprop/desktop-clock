/**
 * SettingsApp - the settings window shell.
 *
 * Layout: fixed sidebar navigation + scrollable content area with a header.
 * Sections are split into their own files under `src/settings/sections`.
 */

import { useEffect, useMemo, useState } from "react";
import { useSettings } from "../services/settingsStore";
import Logo from "../components/Logo";
import ClockSection from "./sections/ClockSection";
import AppearanceSection from "./sections/AppearanceSection";
import TypographySection from "./sections/TypographySection";
import TimezonesSection from "./sections/TimezonesSection";
import PositionSection from "./sections/PositionSection";
import WidgetSection from "./sections/WidgetSection";
import SystemSection from "./sections/SystemSection";
import AboutSection from "./sections/AboutSection";

export type SectionId =
  | "clock"
  | "appearance"
  | "typography"
  | "timezones"
  | "position"
  | "widget"
  | "system"
  | "about";

interface NavItem {
  id: SectionId;
  label: string;
  title: string;
  description: string;
  icon: string;
}

export const SECTIONS: NavItem[] = [
  {
    id: "clock",
    label: "Clock",
    title: "Clock",
    description: "Time format and what the clock displays.",
    icon: "M12 8v4l3 2M12 3a9 9 0 100 18 9 9 0 000-18z",
  },
  {
    id: "appearance",
    label: "Appearance",
    title: "Appearance",
    description: "Theme, colours, opacity, border, shadow and glow.",
    icon: "M4 5h16v10H4zM4 19h10M10 15v4",
  },
  {
    id: "typography",
    label: "Typography",
    title: "Typography",
    description: "Font family, size, weight and spacing.",
    icon: "M5 6h14M12 6v13M8 19h8",
  },
  {
    id: "timezones",
    label: "Time Zones",
    title: "Time Zones",
    description: "Add and manage additional clocks around the world.",
    icon: "M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c3 4 3 14 0 18",
  },
  {
    id: "position",
    label: "Position",
    title: "Position",
    description: "Which monitor to use and how the clock is placed.",
    icon: "M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z M12 11a2 2 0 100-4 2 2 0 000 4z",
  },
  {
    id: "widget",
    label: "Widget",
    title: "Widget behaviour",
    description: "Dragging, resizing, transparency interaction and stacking.",
    icon: "M4 4h16v16H4zM4 9h16",
  },
  {
    id: "system",
    label: "System",
    title: "System",
    description: "Startup, tray and global keyboard shortcut.",
    icon: "M12 15a3 3 0 100-6 3 3 0 000 6zM19 12a7 7 0 00-.1-1l2-1.5-2-3.4-2.3 1a7 7 0 00-1.7-1L14.5 3h-4l-.4 2.6a7 7 0 00-1.7 1l-2.3-1-2 3.4L6 11a7 7 0 000 2l-2 1.5 2 3.4 2.3-1a7 7 0 001.7 1l.4 2.6h4l.4-2.6a7 7 0 001.7-1l2.3 1 2-3.4-2-1.5c.1-.3.1-.7.1-1z",
  },
  {
    id: "about",
    label: "About",
    title: "About",
    description: "Version and project information.",
    icon: "M12 3a9 9 0 100 18 9 9 0 000-18zM12 8h.01M11 12h1v4h1",
  },
];

export default function SettingsApp() {
  const [active, setActive] = useState<SectionId>("clock");
  const reset = useSettings((s) => s.reset);

  // Allow the widget context menu to jump to a section.
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (SECTIONS.some((s) => s.id === detail)) setActive(detail as SectionId);
    };
    window.addEventListener("navigate", handler);
    return () => window.removeEventListener("navigate", handler);
  }, []);

  const current = useMemo(
    () => SECTIONS.find((s) => s.id === active) ?? SECTIONS[0]!,
    [active],
  );

  return (
    <div className="settings-root">
      <aside className="settings-sidebar" aria-label="Settings navigation">
        <div className="settings-sidebar__brand">
          <Logo className="settings-sidebar__brand-mark" size={30} idSuffix="sidebar" />
          <div className="settings-sidebar__brand-text">
            <strong>Desktop Clock</strong>
            <span>Widget settings</span>
          </div>
        </div>

        <nav aria-label="Sections">
          {SECTIONS.map((section) => (
            <button
              key={section.id}
              className="settings-nav-item"
              aria-current={active === section.id ? "page" : undefined}
              onClick={() => setActive(section.id)}
            >
              <svg
                className="settings-nav-item__icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d={section.icon} />
              </svg>
              {section.label}
            </button>
          ))}
        </nav>

        <div style={{ marginTop: "auto", padding: "12px 10px 4px" }}>
          <button
            className="ui-button"
            style={{ width: "100%" }}
            onClick={() => {
              if (confirm("Reset every setting to its default value?")) reset();
            }}
          >
            Reset all settings
          </button>
        </div>
      </aside>

      <main className="settings-main">
        <header className="settings-header">
          <div>
            <h1>{current.title}</h1>
            <p>{current.description}</p>
          </div>
        </header>

        <div className="settings-content" key={active}>
          {active === "clock" && <ClockSection />}
          {active === "appearance" && <AppearanceSection />}
          {active === "typography" && <TypographySection />}
          {active === "timezones" && <TimezonesSection />}
          {active === "position" && <PositionSection />}
          {active === "widget" && <WidgetSection />}
          {active === "system" && <SystemSection />}
          {active === "about" && <AboutSection />}
        </div>
      </main>
    </div>
  );
}