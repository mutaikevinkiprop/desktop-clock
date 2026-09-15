/**
 * Typography settings: font family, size, weight, spacing and line height.
 */

import { useSettings } from "../../services/settingsStore";
import { FONTS } from "../../themes/fonts";
import { Panel, Row, Section, Slider } from "../../components/Controls";
import WidgetPreview from "../../components/WidgetPreview";

export default function TypographySection() {
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);

  return (
    <>
      <Section title="Preview">
        <WidgetPreview />
      </Section>

      <Section title="Font">
        <Panel>
          {FONTS.map((font) => (
            <div className="settings-row" key={font.id}>
              <div className="settings-row__label">
                <strong style={{ fontFamily: font.stack }}>{font.name}</strong>
                <span style={{ fontFamily: font.stack }}>
                  {font.preview} — THURSDAY 10 SEPTEMBER
                </span>
              </div>
              <div className="settings-row__control">
                <button
                  className={
                    settings.fontFamily === font.id ? "ui-button ui-button--primary" : "ui-button"
                  }
                  aria-pressed={settings.fontFamily === font.id}
                  onClick={() => update({ fontFamily: font.id })}
                >
                  {settings.fontFamily === font.id ? "Selected" : "Use"}
                </button>
              </div>
            </div>
          ))}
        </Panel>
      </Section>

      <Section title="Sizing">
        <Panel>
          <Row title="Font size" htmlFor="fontSize">
            <Slider
              id="fontSize"
              label="Font size"
              value={settings.fontSize}
              min={14}
              max={200}
              onChange={(value) => update({ fontSize: value })}
              format={(v) => `${v}px`}
            />
          </Row>
          <Row title="Font weight" htmlFor="fontWeight">
            <Slider
              id="fontWeight"
              label="Font weight"
              value={settings.fontWeight}
              min={100}
              max={900}
              step={100}
              onChange={(value) => update({ fontWeight: value })}
            />
          </Row>
          <Row title="Letter spacing" htmlFor="letterSpacing">
            <Slider
              id="letterSpacing"
              label="Letter spacing"
              value={settings.letterSpacing}
              min={-10}
              max={40}
              step={0.5}
              onChange={(value) => update({ letterSpacing: value })}
              format={(v) => `${v}px`}
            />
          </Row>
          <Row title="Line height" htmlFor="lineHeight">
            <Slider
              id="lineHeight"
              label="Line height"
              value={settings.lineHeight}
              min={0.8}
              max={2}
              step={0.05}
              onChange={(value) => update({ lineHeight: value })}
              format={(v) => v.toFixed(2)}
            />
          </Row>
        </Panel>
      </Section>
    </>
  );
}