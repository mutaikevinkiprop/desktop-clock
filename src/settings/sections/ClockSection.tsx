/**
 * Clock settings: format, visible elements, and the customisable hacker
 * colour sync.
 */

import { useSettings } from "../../services/settingsStore";
import { ColorInput, Panel, RadioGroup, Row, Section, Segmented, Toggle } from "../../components/Controls";
import type { HackerMode, HackerPaletteSource, TimeFormat } from "../../types";
import { HACKER_PALETTE, parseColorToHex } from "../../utils/hackerPalette";

export default function ClockSection() {
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);

  const customColors = settings.hackerCustomColors;
  const isCustom = settings.hackerPaletteSource === "custom";

  const setCustomColor = (index: number, value: string) => {
    const next = [...customColors];
    // Accept HEX / RGB / HSL input; normalise to #rrggbb for storage.
    next[index] = parseColorToHex(value) ?? value;
    update({ hackerCustomColors: next });
  };

  const addCustomColor = () => {
    if (customColors.length >= 12) return;
    const suggestion =
      HACKER_PALETTE[customColors.length % HACKER_PALETTE.length]!.text;
    update({ hackerCustomColors: [...customColors, suggestion] });
  };

  const removeCustomColor = (index: number) => {
    if (customColors.length <= 1) return;
    update({
      hackerCustomColors: customColors.filter((_, i) => i !== index),
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

      <Section title="Hacker sync">
        <Panel>
          <Row
            title="Mode"
            description="Follow your own theme colours, hold one colour, or rotate through a palette."
          >
            <Segmented<HackerMode>
              ariaLabel="Hacker sync mode"
              value={settings.hackerMode}
              options={[
                { value: "off", label: "Off" },
                { value: "fixed", label: "Fixed" },
                { value: "rotate", label: "Rotate" },
              ]}
              onChange={(value) => update({ hackerMode: value })}
            />
          </Row>

          {settings.hackerMode !== "off" && (
            <Row
              title="Colour set"
              description="The classic hacker palette, or your own custom colours."
            >
              <Segmented<HackerPaletteSource>
                ariaLabel="Palette source"
                value={settings.hackerPaletteSource}
                options={[
                  { value: "preset", label: "Classic" },
                  { value: "custom", label: "Custom" },
                ]}
                onChange={(value) => update({ hackerPaletteSource: value })}
              />
            </Row>
          )}

          {settings.hackerMode === "fixed" && (
            <Row
              title="Pinned colour"
              description="The single colour the clock keeps."
            >
              <div className="hacker-swatches" role="radiogroup" aria-label="Fixed colour">
                {(isCustom ? customColors : HACKER_PALETTE.map((e) => e.text)).map(
                  (colour, index) => {
                    const preset = isCustom ? null : HACKER_PALETTE[index]!;
                    const id = preset ? preset.id : `custom-${index}`;
                    const selected = isCustom
                      ? customColors[index] === settings.hackerFixedColor
                      : preset!.id === settings.hackerFixedId;
                    return (
                      <button
                        key={id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        aria-label={preset ? preset.name : colour}
                        title={preset ? preset.name : colour}
                        className="hacker-swatch"
                        data-selected={selected}
                        style={{ background: parseColorToHex(colour) ?? "#000000" }}
                        onClick={() =>
                          isCustom
                            ? update({ hackerFixedColor: colour })
                            : update({ hackerFixedId: preset!.id })
                        }
                      />
                    );
                  },
                )}
              </div>
            </Row>
          )}

          {settings.hackerMode === "rotate" && (
            <Row
              title="Rotation interval"
              description="How often the colour changes. The classic palette at 60s stays in sync with the hacker wallpaper."
            >
              <select
                className="ui-select"
                value={String(settings.hackerRotateSeconds)}
                onChange={(e) =>
                  update({ hackerRotateSeconds: Number(e.target.value) })
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

          {settings.hackerMode !== "off" && isCustom && (
            <Row
              title="Custom colours"
              description="Pick colours or type HEX / RGB / HSL values. They rotate in this order."
            >
              <div className="hacker-custom-colors">
                {customColors.map((colour, index) => (
                  <div className="hacker-custom-color" key={index}>
                    <span
                      className="hacker-custom-color__dot"
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
                      className="hacker-custom-color__remove"
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