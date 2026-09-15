/**
 * Bridges events between the Rust tray, the settings window and the widget
 * window, and keeps both windows' in-memory stores in sync.
 *
 * Tauri windows are independent JavaScript contexts, so a settings change made
 * in the settings window is broadcast on `settings://changed` and every other
 * window re-hydrates from the shared persisted store. This keeps the live
 * widget in sync with the settings panel without a full reload.
 */

import { emit } from "@tauri-apps/api/event";
import { isTauri } from "./native";
import { loadSettings } from "./persistence";
import type { useSettings } from "./settingsStore";

type StoreApi = typeof useSettings;

/** Broadcast to every other window that the persisted settings changed. */
export async function broadcastSettings(): Promise<void> {
  if (!isTauri()) return;
  try {
    await emit("settings://changed", { at: Date.now() });
  } catch {
    /* best-effort */
  }
}

/**
 * Subscribe to native tray/global events and cross-window settings broadcasts.
 * Safe to call in a browser (no-op). Returns an unsubscribe function.
 */
export async function attachNativeListeners(store: StoreApi): Promise<() => void> {
  if (!isTauri()) return () => {};

  try {
    const { listen } = await import("@tauri-apps/api/event");
    const { useSettings: storeImpl } = await import("./settingsStore");
    const get = store.getState;

    const unlisteners = await Promise.all([
      // Tray interactions.
      listen("tray://toggled", () => {
        const s = get();
        get().set("widgetVisible", !s.settings.widgetVisible);
      }),
      listen("tray://show", () => get().set("widgetVisible", true)),
      listen("tray://hide", () => get().set("widgetVisible", false)),
      listen("tray://always-on-top", (event) => {
        get().set("alwaysOnTop", Boolean(event.payload));
      }),
      listen("tray://autostart", (event) => {
        get().set("autostart", Boolean(event.payload));
      }),
      listen("tray://centered", () => {
        void get().refreshMonitors();
      }),

      // Another window changed settings: reload from the shared file and
      // re-apply native side effects so this window matches.
      listen("settings://changed", async () => {
        const loaded = await loadSettings();
        storeImpl.setState({ settings: loaded });
        await get().applyNativeAll();
      }),
    ]);

    return () => {
      for (const un of unlisteners) void un();
    };
  } catch (error) {
    console.error("[events] failed to attach listeners:", error);
    return () => {};
  }
}