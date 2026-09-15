/**
 * Time-zone settings: add, rename, reorder, show/hide and remove extra clocks.
 */

import { useMemo, useState } from "react";
import { useSettings } from "../../services/settingsStore";
import { COMMON_ZONES, isValidTimeZone, zoneOffsetLabel } from "../../utils/time";
import { Panel, Row, Section } from "../../components/Controls";

export default function TimezonesSection() {
  const clocks = useSettings((s) => s.settings.clocks);
  const addClock = useSettings((s) => s.addClock);
  const removeClock = useSettings((s) => s.removeClock);
  const updateClock = useSettings((s) => s.updateClock);
  const moveClock = useSettings((s) => s.moveClock);

  const [zone, setZone] = useState(COMMON_ZONES[0]!);

  const alreadyAdded = useMemo(
    () => new Set(clocks.filter((c) => c.visible).map((c) => c.zone)),
    [clocks],
  );

  const now = new Date();

  return (
    <>
      <Section title="Add a time zone">
        <Panel>
          <Row
            title="Time zone"
            description="Choose any IANA time zone. Daylight saving is handled automatically."
          >
            <select
              className="ui-select"
              aria-label="Time zone to add"
              value={zone}
              onChange={(e) => setZone(e.target.value)}
            >
              {COMMON_ZONES.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
            <button
              className="ui-button ui-button--primary"
              disabled={alreadyAdded.has(zone)}
              onClick={() => addClock(zone)}
            >
              Add clock
            </button>
          </Row>
          <Row
            title="Custom identifier"
            description="Enter a zone such as America/Argentina/Buenos_Aires."
          >
            <CustomZoneInput onAdd={addClock} />
          </Row>
        </Panel>
      </Section>

      <Section title={`Added clocks (${clocks.length})`}>
        {clocks.length === 0 ? (
          <div className="empty-state">
            No additional clocks yet. Add one above to show more time zones beneath
            the main clock.
          </div>
        ) : (
          <div className="clock-list">
            {clocks.map((clock, index) => (
              <div className="clock-list-item" key={clock.id}>
                <span className="clock-list-item__drag" aria-hidden="true">
                  ≡
                </span>

                <div className="clock-list-item__fields">
                  <input
                    className="ui-input"
                    style={{ minWidth: 0, width: "100%" }}
                    value={clock.label}
                    aria-label={`Label for ${clock.zone}`}
                    onChange={(e) =>
                      updateClock(clock.id, { label: e.target.value.toUpperCase() })
                    }
                  />
                  <span className="clock-list-item__zone">
                    {clock.zone} · {zoneOffsetLabel(now, clock.zone) || "—"}
                  </span>
                </div>

                <button
                  className="ui-button"
                  aria-pressed={clock.visible}
                  onClick={() => updateClock(clock.id, { visible: !clock.visible })}
                >
                  {clock.visible ? "Shown" : "Hidden"}
                </button>

                <div className="clock-list-item__actions">
                  <button
                    className="icon-button"
                    title="Move up"
                    aria-label={`Move ${clock.label} up`}
                    disabled={index === 0}
                    onClick={() => moveClock(clock.id, -1)}
                  >
                    ↑
                  </button>
                  <button
                    className="icon-button"
                    title="Move down"
                    aria-label={`Move ${clock.label} down`}
                    disabled={index === clocks.length - 1}
                    onClick={() => moveClock(clock.id, 1)}
                  >
                    ↓
                  </button>
                  <button
                    className="icon-button"
                    title="Remove"
                    aria-label={`Remove ${clock.label}`}
                    onClick={() => removeClock(clock.id)}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}

/** Inline input for arbitrary IANA zone identifiers. */
function CustomZoneInput({ onAdd }: { onAdd: (zone: string) => void }) {
  const [value, setValue] = useState("");
  const valid = isValidTimeZone(value.trim());

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <input
        className="ui-input"
        placeholder="e.g. America/Argentina/Buenos_Aires"
        value={value}
        aria-label="Custom time zone identifier"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && valid) {
            onAdd(value.trim());
            setValue("");
          }
        }}
      />
      <button
        className="ui-button"
        disabled={!valid}
        onClick={() => {
          onAdd(value.trim());
          setValue("");
        }}
      >
        Add
      </button>
    </div>
  );
}