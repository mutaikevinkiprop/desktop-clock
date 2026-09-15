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
import { createDefaultSettings, sanitizeSettings, applyThemeValues } from "../settings/defaults";
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
  centerNow: () => Promise<void>;
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
  version: undefined,
  localZone: undefined,
};

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
    const next = sanitizeSettings({ ...previous, ...patch });
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
    const next = applyThemeValues(get().settings, theme);
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

  centerNow: async () => {
    const { settings } = get();
    await native.centerWindow(settings.monitor);
    await get().saveCurrentPosition();
  },

  centerOnStartupIfEnabled: async () => {
    const { settings } = get();
    if (settings.centerOnStartup) {
      await native.centerWindow(settings.monitor);
    } else if (settings.savedPosition) {
      await native.setWidgetPosition(settings.savedPosition.x, settings.savedPosition.y);
    }
    // Guard against a saved position that is now off-screen (monitor removed,
    // resolution changed, DPI changed).
    const rect = await native.ensureOnScreen();
    // Re-center if the guard had to relocate a centered clock.
    if (rect && settings.positionMode === "center" && settings.centerOnStartup) {
      await native.centerWindow(settings.monitor);
    }
    await get().saveCurrentPosition();
  },

  saveCurrentPosition: async () => {
    const { settings } = get();
    if (settings.positionMode === "center") return;
    const rect = await native.getWidgetRect();
    if (!rect) return;
    const scale = await native.getScaleFactor();
    const factor = scale > 0 ? scale : 1;
    setState({
      settings: {
        ...settings,
        savedPosition: {
          x: Math.round(rect.x / factor),
          y: Math.round(rect.y / factor),
        },
      },
    });
    persist(get().settings);
  },

  applyNativeAll: async () => {
    const s = get().settings;
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