/**
 * Appearance settings: themes, colours, opacity, borders, shadow and glow.
 * A live preview at the top mirrors the widget exactly.
 */

import { useSettings } from "../../services/settingsStore";
import { THEMES } from "../../themes";
import { ColorInput, Panel, Row, Section, Segmented, Slider, Toggle } from "../../components/Controls";
import WidgetPreview from "../../components/WidgetPreview";
import type { ThemeId } from "../../types";

export default function AppearanceSection() {
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);
  const applyTheme = useSettings((s) => s.applyTheme);

  return (
    <>
      <Section title="Preview">
        <WidgetPreview />
      </Section>

      <Section title="Theme">
        <div className="theme-grid">
          {THEMES.map((theme) => (
            <button
              key={theme.id}
              className="theme-card"
              aria-pressed={settings.theme === theme.id}
              onClick={() => applyTheme(theme.id as ThemeId)}
            >
              <span
                className="theme-card__preview"
                style={{
                  background: theme.swatch[0],
                  color: theme.swatch[1],
                  fontFamily:
                    theme.id === "cyber" || theme.id === "retro"
                      ? "Consolas, monospace"
                      : "inherit",
                  borderColor: theme.swatch[2] + "66",
                }}
              >
                13:09
              </span>
              <span className="theme-card__name">{theme.name}</span>
              <span className="theme-card__desc">{theme.description}</span>
            </button>
          ))}
        </div>
        {settings.theme === "custom" && (
          <p style={{ fontSize: 12, color: "var(--ui-text-dim)", marginTop: 10 }}>
            Custom — your colours differ from every preset.
          </p>
        )}
      </Section>

      <Section title="Colours">
        <Panel>
          <Row title="Background" description="Panel fill colour.">
            <ColorInput
              label="Background colour"
              value={settings.backgroundColor}
              onChange={(value) => update({ backgroundColor: value })}
            />
          </Row>
          <Row title="Text" description="Main clock colour.">
            <ColorInput
              label="Text colour"
              value={settings.textColor}
              onChange={(value) => update({ textColor: value })}
            />
          </Row>
          <Row title="Accent" description="Used for time-zone offsets and highlights.">
            <ColorInput
              label="Accent colour"
              value={settings.accentColor}
              onChange={(value) => update({ accentColor: value })}
            />
          </Row>
        </Panel>
      </Section>

      <Section title="Surface">
        <Panel>
          <Row
            title="Opacity"
            description="How much of the desktop shows through the panel."
            htmlFor="opacity"
          >
            <Slider
              id="opacity"
              label="Opacity"
              value={settings.opacity}
              min={0}
              max={100}
              onChange={(value) => update({ opacity: value })}
              format={(v) => `${v}%`}
            />
          </Row>
          <Row
            title="Glass blur"
            description="Frosted-glass blur applied behind the panel."
            htmlFor="blur"
          >
            <Slider
              id="blur"
              label="Glass blur"
              value={settings.blur}
              min={0}
              max={40}
              onChange={(value) => update({ blur: value })}
              format={(v) => `${v}px`}
            />
          </Row>
          <Row title="Corner radius" htmlFor="radius">
            <Slider
              id="radius"
              label="Corner radius"
              value={settings.cornerRadius}
              min={0}
              max={64}
              onChange={(value) => update({ cornerRadius: value })}
              format={(v) => `${v}px`}
            />
          </Row>
          <Row title="Padding" htmlFor="padding">
            <Slider
              id="padding"
              label="Padding"
              value={settings.padding}
              min={0}
              max={80}
              onChange={(value) => update({ padding: value })}
              format={(v) => `${v}px`}
            />
          </Row>
        </Panel>
      </Section>

      <Section title="Border">
        <Panel>
          <Row
            title="Show border"
            description="A thin outline around the panel."
          >
            <Toggle
              checked={settings.borderEnabled}
              label="Show border"
              onChange={(checked) => update({ borderEnabled: checked })}
            />
          </Row>
          <Row title="Border colour">
            <ColorInput
              label="Border colour"
              value={settings.borderColor}
              onChange={(value) => update({ borderColor: value })}
            />
          </Row>
          <Row title="Border thickness" htmlFor="borderWidth">
            <Slider
              id="borderWidth"
              label="Border thickness"
              value={settings.borderWidth}
              min={0}
              max={8}
              onChange={(value) => update({ borderWidth: value })}
              format={(v) => `${v}px`}
            />
          </Row>
        </Panel>
      </Section>

      <Section title="Shadow and glow">
        <Panel>
          <Row title="Drop shadow" description="A soft shadow beneath the clock.">
            <Toggle
              checked={settings.shadowStrength > 0}
              label="Drop shadow"
              onChange={(checked) => update({ shadowStrength: checked ? 45 : 0 })}
            />
          </Row>
          <Row title="Shadow strength" htmlFor="shadow">
            <Slider
              id="shadow"
              label="Shadow strength"
              value={settings.shadowStrength}
              min={0}
              max={100}
              onChange={(value) => update({ shadowStrength: value })}
              format={(v) => `${v}%`}
            />
          </Row>
          <Row title="Text glow" description="A subtle neon glow around the digits.">
            <Toggle
              checked={settings.glowEnabled}
              label="Text glow"
              onChange={(checked) => update({ glowEnabled: checked })}
            />
          </Row>
          <Row title="Glow strength" htmlFor="glow">
            <Slider
              id="glow"
              label="Glow strength"
              value={settings.glowStrength}
              min={0}
              max={100}
              onChange={(value) => update({ glowStrength: value })}
              format={(v) => `${v}%`}
            />
          </Row>
        </Panel>
      </Section>

      <Section title="Presets">
        <Panel>
          <Row
            title="Transparency level"
            description="Quick presets that only change opacity and blur."
          >
            <Segmented
              ariaLabel="Transparency preset"
              value={
                settings.opacity >= 95
                  ? "solid"
                  : settings.opacity <= 30
                    ? "glass"
                    : "translucent"
              }
              options={[
                { value: "solid", label: "Solid" },
                { value: "translucent", label: "Soft" },
                { value: "glass", label: "Glass" },
              ]}
              onChange={(value) => {
                if (value === "solid") update({ opacity: 100, blur: 0 });
                if (value === "translucent") update({ opacity: 80, blur: 12 });
                if (value === "glass") update({ opacity: 22, blur: 28 });
              }}
            />
          </Row>
        </Panel>
      </Section>
    </>
  );
}