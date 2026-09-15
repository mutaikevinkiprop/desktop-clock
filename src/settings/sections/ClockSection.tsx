/**
 * Clock settings: format and visible elements.
 */

import { useSettings } from "../../services/settingsStore";
import { Panel, RadioGroup, Row, Section, Segmented, Toggle } from "../../components/Controls";
import type { TimeFormat } from "../../types";

export default function ClockSection() {
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);

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
    </>
  );
}