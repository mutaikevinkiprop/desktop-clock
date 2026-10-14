/**
 * ContributionWidget - the floating contribution-heatmap widget surface.
 *
 * A transparent, borderless, NON-RESIZABLE window that spans the full width of
 * its monitor (horizontally centered, vertically centered). ONLY the coloured
 * squares (and the optional headline) are visible: the background is fully
 * transparent - no image, colour, gradient, card tint or overlay - and the
 * squares sit flush against the left and right edges of the window.
 *
 * Owns its own lifecycle: fitting the fixed band on startup, and visibility
 * syncing with settings. Data is fetched from the backend for the GitHub
 * source, with a local demo pattern as the fallback.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import ContributionGrid from "./ContributionGrid";
import { useSettings } from "../services/settingsStore";
import { applyThemeVariables } from "../services/themeApply";
import { useEffectiveThemeColors } from "../utils/useEffectiveThemeColors";
import * as native from "../services/native";
import type { ContributionGraph } from "../services/native";
import { simulateGrid, totalOf, longestStreak } from "../utils/contributionGrid";

export default function ContributionWidget() {
  const settings = useSettings((s) => s.settings);
  const loaded = useSettings((s) => s.loaded);
  const c = settings.contributions;
  const rootRef = useRef<HTMLDivElement>(null);

  // The grid colour is the SAME effective theme colour the clock renders
  // with (hacker-sync aware), so the two widgets can never diverge.
  const { textColor, accentColor } = useEffectiveThemeColors();

  // Apply the theme variables (headline colour etc.) exactly like the clock.
  useEffect(() => {
    if (!rootRef.current) return;
    applyThemeVariables(
      { ...settings, textColor, accentColor },
      rootRef.current,
    );
  }, [settings, textColor, accentColor]);

  // --- Live data ------------------------------------------------------------
  const [graph, setGraph] = useState<ContributionGraph | null>(null);
  const [loading, setLoading] = useState(false);

  // Headline figures: from the live graph when available, otherwise computed
  // from the same simulated grid the canvas draws (so the total is never "--").
  const headline = (() => {
    if (graph) {
      return { total: graph.total || 0, streak: graph.longest_streak || 0 };
    }
    const weeks = simulateGrid(Math.floor(Date.now() / 8.64e7));
    return { total: totalOf(weeks), streak: longestStreak(weeks) };
  })();

  const fetchData = useCallback(async () => {
    const cfg = useSettings.getState().settings.contributions;
    if (cfg.source !== "github" || !cfg.username) {
      setGraph(null);
      return;
    }
    setLoading(true);
    try {
      const g = await native.getContributions(cfg.username);
      setGraph(g);
    } finally {
      setLoading(false);
    }
  }, []);

  // Refetch when the source or username changes (debounced for typing).
  useEffect(() => {
    if (!loaded) return;
    const cfg = c;
    if (cfg.source !== "github" || !cfg.username) {
      setGraph(null);
      return;
    }
    const t = setTimeout(fetchData, 500);
    return () => clearTimeout(t);
  }, [loaded, c.source, c.username, fetchData]);

  // Refresh hourly (GitHub updates a few times a day).
  useEffect(() => {
    if (!loaded || c.source !== "github") return;
    const id = setInterval(fetchData, 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [loaded, c.source, fetchData]);

  // --- Startup fitting ------------------------------------------------------
  // The window is a fixed band that lives with the clock: fit it to the
  // monitor the clock is on. The Rust side re-fits on display/DPI changes and
  // whenever the clock settles on a new monitor.
  const fitted = useRef(false);
  useEffect(() => {
    if (!loaded || fitted.current) return;
    fitted.current = true;
    const store = useSettings.getState();
    void store.refreshMonitors().then(() => native.fitContribToClockMonitor());
  }, [loaded]);

  // Reflect the enabled state on the native window. `sync_contrib` never
  // focuses the window (so it cannot pop over the settings window) and keeps
  // the clock above the grid.
  useEffect(() => {
    if (!loaded) return;
    void native.syncContrib(c.enabled, settings.alwaysOnTop);
  }, [loaded, c.enabled, settings.alwaysOnTop]);

  return (
    <div
      className="contrib-root"
      ref={rootRef}
      data-theme={settings.theme}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="contrib-card">
        {c.headline && (
          <div className="contrib-headline">
            <span className="contrib-user">
              {c.username ? `@${c.username}` : "contributions"}
            </span>
            <span className="contrib-total">
              {headline.total.toLocaleString()}
            </span>
            <span className="contrib-sub">
              {headline.streak > 0 ? `best streak ${headline.streak}d` : "no contributions yet"}
            </span>
          </div>
        )}

        <ContributionGrid
          settings={c}
          color={textColor}
          graph={graph}
          loading={loading}
        />
      </div>
    </div>
  );
}
