/**
 * Clock settings: format, visible elements, and the customisable colour
 * sync.
 */

import { useSettings } from "../../services/settingsStore";
import { ColorInput, Panel, RadioGroup, Row, Section, Segmented, Toggle } from "../../components/Controls";
import type { ColorSyncMode, ColorPaletteSource, TimeFormat } from "../../types";
import { CLASSIC_PALETTE, parseColorToHex } from "../../utils/colorPalette";

export default function ClockSection() {
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);

  const customColors = settings.colorCustomColors;
  const isCustom = settings.colorPaletteSource === "custom";

  const setCustomColor = (index: number, value: string) => {
    const next = [...customColors];
    // Accept HEX / RGB / HSL input; normalise to #rrggbb for storage.
    next[index] = parseColorToHex(value) ?? value;
    update({ colorCustomColors: next });
  };

  const addCustomColor = () => {
    if (customColors.length >= 12) return;
    const suggestion =
      CLASSIC_PALETTE[customColors.length % CLASSIC_PALETTE.length]!.text;
    update({ colorCustomColors: [...customColors, suggestion] });
  };

  const removeCustomColor = (index: number) => {
    if (customColors.length <= 1) return;
    update({
      colorCustomColors: customColors.filter((_, i) => i !== index),
    });
  };

  return (
    <>
      <Section title="Time format">
        <Panel>
          <Row title="Format" description="12-hour with AM/PM, or 24-hour.">
            <RadioGroup<TimeFormat>
              name="timeFormat"
              value={settings.timeFormat}
              options={[
                { value: "12", label: "12-hour" },
                { value: "24", label: "24-hour" },
              ]}
              onChange={(value) =>
                update({
                  timeFormat: value,
                  autoFormat: false,
                  showAmPm: value === "12" ? settings.showAmPm : false,
                })
              }
            />
          </Row>
          <Row
            title="Detect from Windows"
            description="Follow the system's preferred clock format on launch."
          >
            <Toggle
              checked={settings.autoFormat}
              label="Detect time format automatically"
              onChange={(checked) => update({ autoFormat: checked })}
            />
          </Row>
        </Panel>
      </Section>

      <Section title="Displayed elements">
        <Panel>
          <Row title="Seconds" description="Show a live seconds counter next to the time.">
            <Toggle
              checked={settings.showSeconds}
              label="Show seconds"
              onChange={(checked) => update({ showSeconds: checked })}
            />
          </Row>
          <Row title="AM / PM" description="Only applies to 12-hour format.">
            <Toggle
              checked={settings.showAmPm}
              label="Show AM/PM"
              onChange={(checked) => update({ showAmPm: checked })}
            />
          </Row>
          <Row title="Date" description="Show the calendar date.">
            <Toggle
              checked={settings.showDate}
              label="Show date"
              onChange={(checked) => update({ showDate: checked })}
            />
          </Row>
          <Row title="Day of week" description="Show the weekday name.">
            <Toggle
              checked={settings.showDay}
              label="Show day of week"
              onChange={(checked) => update({ showDay: checked })}
            />
          </Row>
          <Row
            title="Date style"
            description="Full date, or a compact form that suits narrow widgets."
          >
            <Segmented
              ariaLabel="Date style"
              value={settings.compactDate ? "compact" : "full"}
              options={[
                { value: "full", label: "Full" },
                { value: "compact", label: "Compact" },
              ]}
              onChange={(value) => update({ compactDate: value === "compact" })}
            />
          </Row>
        </Panel>
      </Section>

      <Section title="Colour sync">
        <Panel>
          <Row
            title="Mode"
            description="Follow your own theme colours, hold one colour, or rotate through a palette."
          >
            <Segmented<ColorSyncMode>
              ariaLabel="Colour sync mode"
              value={settings.colorSyncMode}
              options={[
                { value: "off", label: "Off" },
                { value: "fixed", label: "Fixed" },
                { value: "rotate", label: "Rotate" },
              ]}
              onChange={(value) => update({ colorSyncMode: value })}
            />
          </Row>

          {settings.colorSyncMode !== "off" && (
            <Row
              title="Colour set"
              description="The classic palette, or your own custom colours."
            >
              <Segmented<ColorPaletteSource>
                ariaLabel="Palette source"
                value={settings.colorPaletteSource}
                options={[
                  { value: "preset", label: "Classic" },
                  { value: "custom", label: "Custom" },
                ]}
                onChange={(value) => update({ colorPaletteSource: value })}
              />
            </Row>
          )}

          {settings.colorSyncMode === "fixed" && (
            <Row
              title="Pinned colour"
              description="The single colour the clock keeps."
            >
              <div className="color-swatches" role="radiogroup" aria-label="Fixed colour">
                {(isCustom ? customColors : CLASSIC_PALETTE.map((e) => e.text)).map(
                  (colour, index) => {
                    const preset = isCustom ? null : CLASSIC_PALETTE[index]!;
                    const id = preset ? preset.id : `custom-${index}`;
                    const selected = isCustom
                      ? customColors[index] === settings.colorFixedColor
                      : preset!.id === settings.colorFixedId;
                    return (
                      <button
                        key={id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        aria-label={preset ? preset.name : colour}
                        title={preset ? preset.name : colour}
                        className="color-swatch"
                        data-selected={selected}
                        style={{ background: parseColorToHex(colour) ?? "#000000" }}
                        onClick={() =>
                          isCustom
                            ? update({ colorFixedColor: colour })
                            : update({ colorFixedId: preset!.id })
                        }
                      />
                    );
                  },
                )}
              </div>
            </Row>
          )}

          {settings.colorSyncMode === "rotate" && (
            <Row
              title="Rotation interval"
              description="How often the colour changes. The clock and the contribution grid always switch together."
            >
              <select
                className="ui-select"
                value={String(settings.colorRotateSeconds)}
                onChange={(e) =>
                  update({ colorRotateSeconds: Number(e.target.value) })
                }
              >
                <option value={10}>Every 10 seconds</option>
                <option value={30}>Every 30 seconds</option>
                <option value={60}>Every minute</option>
                <option value={120}>Every 2 minutes</option>
                <option value={300}>Every 5 minutes</option>
              </select>
            </Row>
          )}

          {settings.colorSyncMode !== "off" && isCustom && (
            <Row
              title="Custom colours"
              description="Pick colours or type HEX / RGB / HSL values. They rotate in this order."
            >
              <div className="color-custom-colors">
                {customColors.map((colour, index) => (
                  <div className="color-custom-color" key={index}>
                    <span
                      className="color-custom-color__dot"
                      style={{ background: parseColorToHex(colour) ?? "#000000" }}
                      aria-hidden="true"
                    />
                    <ColorInput
                      value={colour}
                      onChange={(value) => setCustomColor(index, value)}
                      label={`Custom colour ${index + 1}`}
                    />
                    <button
                      type="button"
                      className="color-custom-color__remove"
                      aria-label={`Remove colour ${index + 1}`}
                      title="Remove colour"
                      disabled={customColors.length <= 1}
                      onClick={() => removeCustomColor(index)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="ui-button"
                  disabled={customColors.length >= 12}
                  onClick={addCustomColor}
                >
                  Add colour
                </button>
              </div>
            </Row>
          )}
        </Panel>
      </Section>
    </>
  );
}