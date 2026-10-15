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

// Retry bookkeeping for the live fetch. Module-level so `fetchData` keeps a
// stable identity while the component re-renders.
let contribRetryTimer: number | null = null;
let contribRetryCount = 0;
const MAX_CONTRIB_RETRIES = 6;

function clearContribRetry() {
  if (contribRetryTimer !== null) {
    window.clearTimeout(contribRetryTimer);
    contribRetryTimer = null;
  }
}

export default function ContributionWidget() {
  const settings = useSettings((s) => s.settings);
  const loaded = useSettings((s) => s.loaded);
  const c = settings.contributions;
  const rootRef = useRef<HTMLDivElement>(null);

  // The grid colour is the SAME effective theme colour the clock renders
  // with (colour-sync aware), so the two widgets can never diverge.
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
  const [error, setError] = useState<string | null>(null);

  // Headline figures: from the live graph when available, otherwise computed
  // from the same simulated grid the canvas draws (so the total is never "--").
  const headline = (() => {
    if (graph) {
      return { total: graph.total || 0, streak: graph.longest_streak || 0 };
    }
    const weeks = simulateGrid(Math.floor(Date.now() / 8.64e7));
    return { total: totalOf(weeks), streak: longestStreak(weeks) };
  })();

  // When the last fetch failed there is no real data to show: say so instead
  // of silently presenting the simulated demo numbers as real ones.
  const offlineHint =
    c.source === "github" && error
      ? graph
        ? "offline \u00b7 retrying\u2026"
        : "offline \u00b7 showing demo"
      : null;

  const fetchData = useCallback(async () => {
    const cfg = useSettings.getState().settings.contributions;
    if (cfg.source !== "github" || !cfg.username) {
      clearContribRetry();
      contribRetryCount = 0;
      setGraph(null);
      setError(null);
      return;
    }
    setLoading(true);
    try {
      const g = await native.getContributions(cfg.username);
      if (g) {
        setGraph(g);
        setError(null);
        contribRetryCount = 0;
        return;
      }
      throw new Error("no contribution data returned");
    } catch (err) {
      // Keep the last known-good graph: a transient failure must never swap
      // the user's REAL numbers for the simulated fallback. Retry with
      // growing backoff instead of waiting for the next poll cycle.
      console.error("[contributions] fetch failed:", err);
      setError(err instanceof Error ? err.message : String(err));
      const attempt = contribRetryCount;
      contribRetryCount += 1;
      clearContribRetry();
      if (attempt < MAX_CONTRIB_RETRIES) {
        const delays = [30_000, 60_000, 120_000, 300_000];
        const delay = delays[Math.min(attempt, delays.length - 1)] ?? 300_000;
        contribRetryTimer = window.setTimeout(() => {
          contribRetryTimer = null;
          void fetchData();
        }, delay);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Refetch when the source or username changes (debounced for typing).
  useEffect(() => {
    if (!loaded) return;
    const cfg = c;
    if (cfg.source !== "github" || !cfg.username) {
      clearContribRetry();
      contribRetryCount = 0;
      setGraph(null);
      setError(null);
      return;
    }
    // Drop the previous profile's numbers immediately: they must never show
    // under the new handle while the fresh fetch is in flight.
    clearContribRetry();
    contribRetryCount = 0;
    setGraph(null);
    setError(null);
    const t = setTimeout(fetchData, 500);
    return () => clearTimeout(t);
  }, [loaded, c.source, c.username, fetchData]);

  // Poll every 10 minutes so new contributions appear promptly. GitHub
  // updates the graph within minutes of a push, and the backend's 5-minute
  // cache-buster keeps upstream caches from serving older data.
  useEffect(() => {
    if (!loaded || c.source !== "github") return;
    const id = setInterval(fetchData, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [loaded, c.source, fetchData]);

  // Refetch when the widget becomes visible again (re-shown after being
  // hidden, or the machine resumed from sleep) so it never sits visibly
  // stale.
  useEffect(() => {
    if (!loaded) return;
    const refreshIfVisible = () => {
      if (document.hidden) return;
      const cfg = useSettings.getState().settings.contributions;
      if (cfg.source === "github" && cfg.username) void fetchData();
    };
    document.addEventListener("visibilitychange", refreshIfVisible);
    window.addEventListener("focus", refreshIfVisible);
    return () => {
      document.removeEventListener("visibilitychange", refreshIfVisible);
      window.removeEventListener("focus", refreshIfVisible);
    };
  }, [loaded, fetchData]);

  // Manual "Refresh now" from the settings window: the settings UI is a
  // separate WebView, so the request arrives as a Tauri event.
  useEffect(() => {
    if (!native.isTauri()) return;
    let disposed = false;
    let unlisten: (() => void) | null = null;
    void import("@tauri-apps/api/event")
      .then(({ listen }) => listen("contrib://refresh", () => void fetchData()))
      .then((un) => {
        if (disposed) un();
        else unlisten = un;
      })
      .catch(() => {
        /* best-effort */
      });
    return () => {
      disposed = true;
      if (unlisten) unlisten();
    };
  }, [fetchData]);

  // Never leak a pending retry timer when the widget unmounts.
  useEffect(() => () => clearContribRetry(), []);

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
              {offlineHint ??
                (headline.streak > 0 ? `best streak ${headline.streak}d` : "no contributions yet")}
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
