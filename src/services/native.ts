/**
 * Native bridge to the Tauri/Rust backend.
 *
 * Every call is wrapped so that the app keeps working (in a degraded mode)
 * when the frontend runs in a plain browser. This makes `npm run dev` usable
 * for layout/theme work without a Rust toolchain.
 */

import type { MonitorInfo, Rect } from "../types";

/** True when running inside a Tauri WebView with the IPC bridge available. */
export function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  return "__TAURI_INTERNALS__" in window || "__TAURI__" in window;
}

type InvokeFn = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

let invokeImpl: InvokeFn | null = null;

async function getInvoke(): Promise<InvokeFn | null> {
  if (!isTauri()) return null;
  if (invokeImpl) return invokeImpl;
  try {
    const mod = await import("@tauri-apps/api/core");
    invokeImpl = mod.invoke as InvokeFn;
    return invokeImpl;
  } catch {
    return null;
  }
}

/** Invoke a native command, returning `fallback` when unavailable. */
async function call<T>(cmd: string, args: Record<string, unknown> | undefined, fallback: T): Promise<T> {
  const invoke = await getInvoke();
  if (!invoke) return fallback;
  try {
    return await invoke<T>(cmd, args);
  } catch (error) {
    console.error(`[native] ${cmd} failed:`, error);
    return fallback;
  }
}

// --- Widget visibility -----------------------------------------------------

export const showWidget = () => call<void>("show_widget", undefined, undefined);
export const hideWidget = () => call<void>("hide_widget", undefined, undefined);
export const toggleWidget = () => call<boolean>("toggle_widget", undefined, false);

// --- Settings window -------------------------------------------------------

export const openSettings = () => call<void>("open_settings", undefined, undefined);
export const closeSettings = () => call<void>("close_settings", undefined, undefined);

// --- Positioning -----------------------------------------------------------

export const centerWindow = (monitor: string) =>
  call<Rect | null>("center_window", { monitor }, null);

export const computeCenter = (monitor: string) =>
  call<Rect | null>("compute_center", { monitor }, null);

export const listMonitors = () => call<MonitorInfo[]>("list_monitors", undefined, []);

export const ensureOnScreen = () => call<Rect | null>("ensure_on_screen", undefined, null);

export const getWidgetRect = () =>
  call<Rect | null>("get_widget_rect", undefined, null);

export const setWidgetPosition = (x: number, y: number) =>
  call<void>("set_widget_position", { x, y }, undefined);

export const setWidgetSize = (width: number, height: number) =>
  call<void>("set_widget_size", { width, height }, undefined);

export const getScaleFactor = () => call<number>("get_scale_factor", undefined, 1);

// --- Window flags ----------------------------------------------------------

export const setAlwaysOnTop = (enabled: boolean) =>
  call<void>("set_always_on_top", { enabled }, undefined);

export const setClickThrough = (enabled: boolean) =>
  call<void>("set_click_through", { enabled }, undefined);

export const setResizable = (enabled: boolean) =>
  call<void>("set_resizable", { enabled }, undefined);

// --- System ----------------------------------------------------------------

export const setAutostart = (enabled: boolean) =>
  call<boolean>("set_autostart", { enabled }, enabled);

export const getAutostart = () => call<boolean>("get_autostart", undefined, false);

export const setGlobalShortcut = (accelerator: string | null) =>
  call<boolean>("set_global_shortcut", { accelerator }, false);

export const syncTrayState = (alwaysOnTop: boolean, autostart: boolean) =>
  call<void>("sync_tray_state", { alwaysOnTop, autostart }, undefined);

/** Tell the backend which monitor the global shortcut should center on. */
export const setCenterTarget = (target: string) =>
  call<void>("set_center_target", { target }, undefined);

export const quitApp = () => call<void>("quit_app", undefined, undefined);

// --- Window dragging -------------------------------------------------------

/**
 * Start a native window drag. Must be called from a `mousedown` handler on the
 * draggable element. Falls back to a no-op in the browser.
 */
export async function startDragging(): Promise<void> {
  if (!isTauri()) return;
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().startDragging();
  } catch (error) {
    console.error("[native] startDragging failed:", error);
  }
}

/** Resolve the current window's label ("main" | "settings" | ...). */
export async function currentWindowLabel(): Promise<string> {
  if (!isTauri()) return "browser";
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    return getCurrentWindow().label;
  } catch {
    return "unknown";
  }
}