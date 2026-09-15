/**
 * Settings persistence.
 *
 * Primary storage is the Tauri store plugin (a JSON file in the app-data
 * directory). When it is unavailable (browser dev mode, or a plugin error) we
 * transparently fall back to `localStorage` so the UI still behaves.
 *
 * All reads are sanitised, so a corrupted file can never crash the app.
 */

import type { Settings } from "../types";
import { STORE_FILE, STORE_KEY, sanitizeSettings, createDefaultSettings } from "../settings/defaults";
import { isTauri } from "./native";

const LS_KEY = "desktop-clock:settings";

type StoreLike = {
  get: <T>(key: string) => Promise<T | undefined>;
  set: (key: string, value: unknown) => Promise<void>;
  save: () => Promise<void>;
};

let storePromise: Promise<StoreLike | null> | null = null;

async function getStore(): Promise<StoreLike | null> {
  if (!isTauri()) return null;
  if (storePromise) return storePromise;
  storePromise = (async () => {
    try {
      const { load } = await import("@tauri-apps/plugin-store");
      return (await load(STORE_FILE, { autoSave: false })) as unknown as StoreLike;
    } catch (error) {
      console.error("[settings] store plugin unavailable:", error);
      return null;
    }
  })();
  return storePromise;
}

/** Load settings, always returning a valid object. */
export async function loadSettings(): Promise<Settings> {
  const store = await getStore();
  if (store) {
    try {
      const raw = await store.get<unknown>(STORE_KEY);
      if (raw !== undefined) return sanitizeSettings(raw);
    } catch (error) {
      console.error("[settings] failed to read store:", error);
    }
  }

  // Fallback: localStorage (browser dev mode or store failure).
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return sanitizeSettings(JSON.parse(raw));
  } catch (error) {
    console.error("[settings] failed to read localStorage:", error);
  }

  return createDefaultSettings();
}

/** Persist settings. Failures are logged, never fatal. */
export async function saveSettings(settings: Settings): Promise<void> {
  const store = await getStore();
  if (store) {
    try {
      await store.set(STORE_KEY, settings);
      await store.save();
    } catch (error) {
      console.error("[settings] failed to write store:", error);
    }
  }

  try {
    localStorage.setItem(LS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error("[settings] failed to write localStorage:", error);
  }
}