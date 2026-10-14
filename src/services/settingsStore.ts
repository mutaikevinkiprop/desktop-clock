/**
 * Global settings store (Zustand).
 *
 * Responsibilities:
 * - Hold the canonical `Settings` object in memory.
 * - Persist changes to disk (debounced).
 * - Apply native side effects *only* when the relevant fields actually change,
 *   so typing in a colour field never thrashes the window API.
 * - Expose positioning operations used by the UI, tray and shortcut.
 */

import { create } from "zustand";
import type { MonitorInfo, Settings, ThemeId, TimezoneClock } from "../types";
import {
  createDefaultSettings,
  sanitizeSettings,
  applyThemeValues,
  SETTINGS_VERSION,
} from "../settings/defaults";
import { loadSettings, saveSettings } from "./persistence";
import { broadcastSettings } from "./trayEvents";
import * as native from "./native";
import { uid } from "../utils/dom";
import { zoneToLabel } from "../utils/time";

interface SettingsState {
  settings: Settings;
  monitors: MonitorInfo[];
  loaded: boolean;

  hydrate: () => Promise<void>;

  update: (patch: Partial<Settings>) => void;
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  reset: () => void;

  applyTheme: (theme: ThemeId) => void;

  addClock: (zone: string, label?: string) => void;
  removeClock: (id: string) => void;
  updateClock: (id: string, patch: Partial<TimezoneClock>) => void;
  moveClock: (id: string, direction: -1 | 1) => void;

  refreshMonitors: () => Promise<void>;
  /** Replace the cached monitor list (used by the display-change watcher). */
  setMonitors: (monitors: MonitorInfo[]) => void;
  centerNow: () => Promise<void>;
  /** Apply the current position preset ("center" or "top") right away. */
  positionNow: () => Promise<void>;
  centerOnStartupIfEnabled: () => Promise<void>;
  saveCurrentPosition: () => Promise<void>;

  applyNativeAll: () => Promise<void>;
}

/** Flatten a settings value to a primitive for cheap equality checks. */
function fingerprint(value: unknown): string {
  if (value === null || typeof value !== "object") return String(value);
  return JSON.stringify(value);
}

/** Debounced persistence so rapid slider drags write once. */
const persist = debounceAsync(async (settings: Settings) => {
  await saveSettings(settings);
  // Tell the other window (widget <-> settings) to reload the new values.
  await broadcastSettings();
}, 350);

function debounceAsync<T>(fn: (arg: T) => Promise<void>, wait: number) {
  let handle: ReturnType<typeof setTimeout> | undefined;
  let latest: T | undefined;
  return (arg: T) => {
    latest = arg;
    if (handle) clearTimeout(handle);
    handle = setTimeout(() => {
      handle = undefined;
      if (latest !== undefined) void fn(latest);
    }, wait);
  };
}

/**
 * Fields whose change must trigger a native window call. Each entry maps a
 * settings key to the action to run with its current value.
 */
type NativeEffect = (settings: Settings) => void | Promise<void>;

const NATIVE_EFFECTS: Record<keyof Settings, NativeEffect | undefined> = {
  alwaysOnTop: (s) => native.setAlwaysOnTop(s.alwaysOnTop),
  clickThrough: (s) => native.setClickThrough(s.clickThrough),
  resizable: (s) => native.setResizable(s.resizable),
  autostart: async (s) => { await native.setAutostart(s.autostart); },
  shortcutEnabled: async (s) => { await native.setGlobalShortcut(s.shortcutEnabled ? s.shortcut : null); },
  shortcut: async (s) => { await native.setGlobalShortcut(s.shortcutEnabled ? s.shortcut : null); },
  shortcutTarget: (s) => native.setCenterTarget(s.shortcutTarget),

  // Clock / appearance / typography / timezone / position fields are handled
  // entirely in React and need no native call.
  timeFormat: undefined,
  autoFormat: undefined,
  showSeconds: undefined,
  showAmPm: undefined,
  showDate: undefined,
  showDay: undefined,
  compactDate: undefined,
  theme: undefined,
  backgroundColor: undefined,
  textColor: undefined,
  accentColor: undefined,
  opacity: undefined,
  blur: undefined,
  cornerRadius: undefined,
  padding: undefined,
  borderEnabled: undefined,
  borderColor: undefined,
  borderWidth: undefined,
  shadowEnabled: undefined,
  shadowStrength: undefined,
  glowEnabled: undefined,
  glowStrength: undefined,
  pulseEnabled: undefined,
  fontFamily: undefined,
  fontSize: undefined,
  fontWeight: undefined,
  letterSpacing: undefined,
  lineHeight: undefined,
  clocks: undefined,
  monitor: undefined,
  positionMode: undefined,
  centerOnStartup: undefined,
  savedPosition: undefined,
  draggable: undefined,
  showShadow: undefined,
  widgetSize: undefined,
  widgetVisible: undefined,
  // Changing the hacker mode/colour also restyles the contribution widget.
  hackerMode: (s) => applyContributionNative(s),
  hackerSync: undefined,
  hackerFixedId: (s) => applyContributionNative(s),
  hackerPaletteSource: (s) => applyContributionNative(s),
  hackerCustomColors: (s) => applyContributionNative(s),
  hackerFixedColor: (s) => applyContributionNative(s),
  hackerRotateSeconds: (s) => applyContributionNative(s),
  // The contributions block includes the typable GitHub username; the widget
  // window reloads from the store on its own, so no debounce is needed here.
  contributions: (s) => applyContributionNative(s),
  version: undefined,
  localZone: undefined,
};

/**
 * Show or hide the floating contribution widget to match the settings.
 *
 * The widget window renders from the shared settings store, so we only need to
 * toggle its visibility and fit its fixed full-width band here. Fitting and
 * showing never focus the window, so editing settings can never raise the
 * widget above the settings window.
 */
async function applyContributionNative(s: Settings): Promise<void> {
  if (!s.contributions.enabled) {
    await native.hideContrib();
    return;
  }
  // The band lives with the clock: fit it to the monitor the clock is on.
  await native.fitContribToClockMonitor();
  // Showing the grid raises the clock back above it (respecting the user's
  // always-on-top preference), so the grid never covers the clock.
  await native.syncContrib(true, s.alwaysOnTop);
}

export const useSettings = create<SettingsState>((setState, get) => ({
  settings: createDefaultSettings(),
  monitors: [],
  loaded: false,

  hydrate: async () => {
    const loaded = await loadSettings();
    setState({ settings: loaded, loaded: true });
    await get().applyNativeAll();
    await get().refreshMonitors();
  },

  update: (patch) => {
    const previous = get().settings;
    let next = sanitizeSettings({ ...previous, ...patch });

    // Editing a colour means the user wants THEIR colours: disable the
    // hacker-sync override so the edit is visible immediately instead of
    // being masked by the pinned/rotating palette colour.
    const colourEdited =
      ("textColor" in patch && patch.textColor !== previous.textColor) ||
      ("accentColor" in patch && patch.accentColor !== previous.accentColor) ||
      ("backgroundColor" in patch && patch.backgroundColor !== previous.backgroundColor);
    if (colourEdited && next.hackerMode !== "off") {
      next = { ...next, hackerMode: "off" };
    }

    setState({ settings: next });
    persist(next);

    // Run native effects only for keys that were part of the patch AND whose
    // value actually changed.
    for (const key of Object.keys(patch) as (keyof Settings)[]) {
      if (fingerprint(previous[key]) === fingerprint(next[key])) continue;
      const effect = NATIVE_EFFECTS[key];
      if (effect) void effect(next);
    }

    // Mirror the toggles the tray renders as check items.
    if (
      fingerprint(previous.alwaysOnTop) !== fingerprint(next.alwaysOnTop) ||
      fingerprint(previous.autostart) !== fingerprint(next.autostart)
    ) {
      void native.syncTrayState(next.alwaysOnTop, next.autostart);
    }
  },

  set: (key, value) => get().update({ [key]: value } as Partial<Settings>),

  reset: () => {
    const fresh = createDefaultSettings();
    setState({ settings: fresh });
    persist(fresh);
    void get().applyNativeAll();
  },

  applyTheme: (theme) => {
    // A selected theme owns the colours: disable the hacker-sync override so
    // the theme's palette actually reaches the clock and the contribution
    // grid. (The user can re-enable hacker sync afterwards if they want the
    // palette colour to take over again.)
    const next = {
      ...applyThemeValues(get().settings, theme),
      hackerMode: "off" as const,
    };
    setState({ settings: next });
    persist(next);
  },

  addClock: (zone, label) => {
    const clock: TimezoneClock = {
      id: uid("clock"),
      zone,
      label: (label ?? zoneToLabel(zone)).toUpperCase(),
      visible: true,
    };
    get().update({ clocks: [...get().settings.clocks, clock] });
  },

  removeClock: (id) => {
    get().update({ clocks: get().settings.clocks.filter((c) => c.id !== id) });
  },

  updateClock: (id, patch) => {
    get().update({
      clocks: get().settings.clocks.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    });
  },

  moveClock: (id, direction) => {
    const clocks = [...get().settings.clocks];
    const index = clocks.findIndex((c) => c.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= clocks.length) return;
    const a = clocks[index]!;
    const b = clocks[target]!;
    clocks[index] = b;
    clocks[target] = a;
    get().update({ clocks });
  },

  refreshMonitors: async () => {
    const monitors = await native.listMonitors();
    setState({ monitors });
  },

  setMonitors: (monitors) => {
    setState({ monitors });
  },

  centerNow: async () => {
    const { settings } = get();
    await native.centerWindow(settings.monitor);
    await get().saveCurrentPosition();
  },

  positionNow: async () => {
    const { settings } = get();
    if (settings.positionMode === "top") {
      await native.alignTopWindow(settings.monitor);
    } else {
      await native.centerWindow(settings.monitor);
    }
    await get().saveCurrentPosition();
  },

  centerOnStartupIfEnabled: async () => {
    const { settings } = get();
    // Preset modes place the clock deterministically: "center" (only when
    // auto-centering is enabled) and "top" (always, since it is an explicit
    // preset). A dragged clock (custom position) must stay exactly where the
    // user put it across launches.
    const wantCenter = settings.centerOnStartup && settings.positionMode === "center";
    const wantTop = settings.positionMode === "top";
    if (wantCenter) {
      await native.centerWindow(settings.monitor);
    } else if (wantTop) {
      await native.alignTopWindow(settings.monitor);
    } else if (settings.savedPosition) {
      // Saved positions are PHYSICAL pixels. The backend restores them
      // exactly (no DPI conversion, so mixed-scale multi-monitor setups
      // cannot drift) and validates the requested rect against the monitor
      // layout in the SAME call. Validating the request instead of reading
      // the window back closes the race where an off-screen restore slipped
      // past the guard and left the clock invisible.
      const finalRect = await native.restoreWidgetPosition(
        settings.savedPosition.x,
        settings.savedPosition.y,
        settings.version < 2, // settings v1 stored logical pixels
      );
      if (finalRect) {
        setState({
          settings: {
            ...get().settings,
            savedPosition: { x: finalRect.x, y: finalRect.y },
            version: SETTINGS_VERSION,
          },
        });
        persist(get().settings);
      }
      return;
    }
    // Guard against a preset spot that is now off-screen (monitor removed,
    // resolution changed, DPI changed); preset targets are recomputed from
    // live monitor data, so this only matters when a target no longer exists.
    await native.ensureOnScreen();
    if (wantCenter) {
      await native.centerWindow(settings.monitor);
    } else if (wantTop) {
      await native.alignTopWindow(settings.monitor);
    }
    await get().saveCurrentPosition();
  },

  saveCurrentPosition: async () => {
    const { settings } = get();
    // Preset modes derive their position; only custom spots are persisted.
    if (settings.positionMode !== "custom") return;
    const rect = await native.getWidgetRect();
    if (!rect) return;
    // Physical pixels: virtual-desktop coordinates are uniform across
    // monitors regardless of each display's scale factor, so restoring this
    // position later needs no DPI conversion and cannot drift.
    setState({
      settings: {
        ...settings,
        savedPosition: {
          x: rect.x,
          y: rect.y,
        },
        version: SETTINGS_VERSION,
      },
    });
    persist(get().settings);
  },

  applyNativeAll: async () => {
    const s = get().settings;

    // Bring the contribution widget up (or down) FIRST so a failure elsewhere
    // cannot prevent it. Each step is independently guarded.
    try {
      await applyContributionNative(s);
    } catch (err) {
      console.error("[contributions] failed:", err);
    }

    await Promise.all([
      native.setAlwaysOnTop(s.alwaysOnTop),
      native.setClickThrough(s.clickThrough),
      native.setResizable(s.resizable),
      native.setCenterTarget(s.shortcutTarget),
      native.syncTrayState(s.alwaysOnTop, s.autostart),
    ]);

    // A shortcut conflict must never prevent startup.
    await native.setGlobalShortcut(s.shortcutEnabled ? s.shortcut : null);

    // Reconcile the stored autostart preference with the real OS state.
    try {
      const actual = await native.getAutostart();
      if (actual !== s.autostart) await native.setAutostart(s.autostart);
    } catch {
      /* autostart is optional */
    }
  },
}));