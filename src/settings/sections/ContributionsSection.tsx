/**
 * Contributions settings - the floating contribution-heatmap widget.
 *
 * The widget is a fully transparent overlay (like the clock) that floats on the
 * desktop and draws a GitHub-style contribution grid. It is a FIXED band that
 * spans the full width of its monitor - the squares sit flush against the left
 * and right edges with no margins - and its background is always fully
 * transparent. Its colour always matches the clock's theme colour.
 */

import { useState } from "react";
import { useSettings } from "../../services/settingsStore";
import { Panel, Row, Section, Slider, Toggle } from "../../components/Controls";
import { HACKER_PALETTE } from "../../utils/hackerPalette";
import * as native from "../../services/native";

export default function ContributionsSection() {
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);
  const c = settings.contributions;

  const patch = (p: Partial<typeof c>) => update({ contributions: { ...c, ...p } });

  const [refreshing, setRefreshing] = useState(false);
  async function refreshNow() {
    setRefreshing(true);
    try {
      // Nudging the username (no-op edit) makes the widget refetch, but a
      // dedicated path is clearer: just toggle the source to itself.
      patch({ source: c.source });
      await new Promise((r) => setTimeout(r, 400));
    } finally {
      setTimeout(() => setRefreshing(false), 600);
    }
  }

  return (
    <>
      <Section title="Contribution widget">
        <Panel>
          <Row
            title="Enable widget"
            description="Float the contribution grid on your desktop as a transparent full-width band on your monitor, just like the clock."
          >
            <Toggle
              checked={c.enabled}
              label="Show the contribution widget"
              onChange={(checked) => patch({ enabled: checked })}
            />
          </Row>
        </Panel>
      </Section>

      {c.enabled && (
        <>
          <Section title="Data source">
            <Panel>
              <Row
                title="Contributions from"
                description="Use a real GitHub profile, or a locally-generated pattern that always works offline."
              >
                <select
                  className="ui-select"
                  value={c.source}
                  onChange={(e) => patch({ source: e.target.value as typeof c.source })}
                >
                  <option value="simulated">Simulated (offline)</option>
                  <option value="github">GitHub profile</option>
                </select>
              </Row>
              <Row
                title="Profile name (@handle)"
                description='Your GitHub username, shown above the grid as an @handle label (e.g. "@mutaikevinkiprop"). With the GitHub source it also fetches your real contribution data.'
              >
                <input
                  className="ui-input"
                  type="text"
                  spellCheck={false}
                  placeholder="@mutaikevinkiprop"
                  value={c.username}
                  onChange={(e) =>
                    patch({ username: e.target.value.replace(/[^A-Za-z0-9-]/g, "").slice(0, 39) })
                  }
                />
              </Row>
              {c.source === "github" && (
                <>
                  <Row
                    title="Refresh now"
                    description="Re-fetch this profile's contributions immediately."
                  >
                    <button
                      type="button"
                      className="ui-button"
                      disabled={refreshing || !c.username}
                      onClick={refreshNow}
                    >
                      {refreshing ? "Refreshing\u2026" : "Refresh"}
                    </button>
                  </Row>
                </>
              )}
            </Panel>
          </Section>

          <Section title="Grid & animation">
            <Panel>
              <Row title="Flashing sweep" description="Animate a light running across the squares.">
                <Toggle
                  checked={c.animate}
                  label="Animate the sweep"
                  onChange={(checked) => patch({ animate: checked })}
                />
              </Row>
              {c.animate && (
                <Row title="Speed" description="How fast the sweep travels across the grid.">
                  <Slider
                    label="Sweep speed"
                    min={1}
                    max={10}
                    value={c.speed}
                    format={(v) => `${v}`}
                    onChange={(v) => patch({ speed: v })}
                  />
                </Row>
              )}
              <Row title="Show empty squares" description="Draw the faint empty cells too.">
                <Toggle
                  checked={c.grid}
                  label="Show full grid"
                  onChange={(checked) => patch({ grid: checked })}
                />
              </Row>
              <Row title="Headline" description="Show the contribution total and streak above the grid.">
                <Toggle
                  checked={c.headline}
                  label="Show headline"
                  onChange={(checked) => patch({ headline: checked })}
                />
              </Row>
            </Panel>
          </Section>

          <Section title="Position & size">
            <Panel>
              <Row
                title="Full-width band"
                description="The widget is a fixed, non-resizable band that always spans the full width of its monitor - the squares sit flush against the left and right edges - centered vertically with a fully transparent background."
              >
                <button
                  type="button"
                  className="ui-button"
                  onClick={() => void native.fitContribToMonitor()}
                >
                  Fit to monitor
                </button>
              </Row>
            </Panel>
          </Section>
        </>
      )}

      <Section title="Colour">
        <Panel>
          <Row
            title="Theme source"
            description="The grid always matches the clock's colour: the Hacker sync palette when it is on, otherwise the clock's theme text colour."
          >
            <span style={{ fontSize: 12.5, color: "var(--ui-text-dim)" }}>
              {settings.hackerMode === "rotate"
                ? `Rotating every ${settings.hackerRotateSeconds}s`
                : settings.hackerMode === "fixed"
                  ? `Fixed: ${
                      settings.hackerPaletteSource === "custom"
                        ? settings.hackerFixedColor
                        : HACKER_PALETTE.find((c2) => c2.id === settings.hackerFixedId)?.name ??
                          settings.hackerFixedId
                    }`
                  : "Clock theme colour"}
            </span>
          </Row>
          <Row
            title="Change theme"
            description="Open the Clock page to pick Off, a Fixed colour, or Rotate."
          >
            <button
              type="button"
              className="ui-button"
              onClick={() =>
                window.dispatchEvent(new CustomEvent("navigate", { detail: "clock" }))
              }
            >
              Go to Hacker sync
            </button>
          </Row>
        </Panel>
      </Section>
    </>
  );
}
