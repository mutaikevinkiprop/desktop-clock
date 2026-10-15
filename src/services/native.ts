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
  if (!invoke) {
    console.warn(`[native] ${cmd} skipped: IPC bridge unavailable (not in Tauri?)`);
    return fallback;
  }
  try {
    return await invoke<T>(cmd, args);
  } catch (error) {
    console.error(`[native] ${cmd} failed:`, error);
    return fallback;
  }
}

/**
 * Like `call`, but Tauri IPC errors REJECT instead of being silently replaced
 * with the fallback. Used where the caller must distinguish "no data" from
 * "backend failed" - e.g. the contribution fetch keeps its last known-good
 * graph on failure instead of swapping in the simulated fallback.
 */
async function callStrict<T>(
  cmd: string,
  args: Record<string, unknown> | undefined,
  fallback: T,
): Promise<T> {
  const invoke = await getInvoke();
  if (!invoke) return fallback; // plain browser: degraded mode
  return invoke<T>(cmd, args);
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

export const alignTopWindow = (monitor: string) =>
  call<Rect | null>("align_top_center", { monitor }, null);

export const computeCenter = (monitor: string) =>
  call<Rect | null>("compute_center", { monitor }, null);

export const listMonitors = () => call<MonitorInfo[]>("list_monitors", undefined, []);

export const ensureOnScreen = () => call<Rect | null>("ensure_on_screen", undefined, null);

export const getWidgetRect = () =>
  call<Rect | null>("get_widget_rect", undefined, null);

/**
 * Restore the widget to a saved PHYSICAL position in one atomic call: the
 * backend moves the window and then validates the *requested* rect against the
 * monitor layout (no read-back, which could race the asynchronous move and
 * miss an off-screen restore). Off-screen spots are slid back onto the nearest
 * monitor, and the final rect is returned for persistence.
 *
 * `legacy` marks coordinates written by settings v1 (logical px) so the
 * backend can convert them with the correct monitor scale factor.
 */
export const restoreWidgetPosition = (x: number, y: number, legacy = false) =>
  call<Rect | null>("restore_widget_position", { x, y, legacy }, null);

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

// --- Floating contribution widget -----------------------------------------

/** Show the floating contribution widget (fitted, never focused). */
export const showContrib = () => call<void>("show_contrib", undefined, undefined);

/** Hide the floating contribution widget. */
export const hideContrib = () => call<void>("hide_contrib", undefined, undefined);

/** Show/hide the contribution widget in one call (never focuses it). When
 *  showing, the clock is raised back above the grid. */
export const syncContrib = (visible: boolean, keepClockOnTop = false) =>
  call<void>("sync_contrib", { visible, keep_clock_on_top: keepClockOnTop }, undefined);

/**
 * Fit the contribution widget to the fixed full-width band on its monitor.
 * `monitor` accepts the same keys as `centerWindow` and defaults to the
 * monitor the window currently lives on.
 */
export const fitContribToMonitor = (monitor?: string) =>
  call<Rect | null>("fit_contrib_to_monitor", { monitor }, null);

/**
 * Fit the contribution band to the monitor the CLOCK is currently on, so the
 * graph always follows the clock - including when a display change (lid
 * closed, "Second screen only") relocates the clock.
 */
export const fitContribToClockMonitor = () =>
  call<Rect | null>("fit_contrib_to_clock", undefined, null);

/** The contribution widget's outer rect (physical px). */
export const getContribRect = () =>
  call<Rect | null>("get_contrib_rect", undefined, null);

/** The contribution widget's monitor scale factor. */
export const getContribScale = () =>
  call<number>("get_contrib_scale", undefined, 1);

/** Center the contribution widget on a monitor key (fits the fixed band). */
export const centerContrib = (monitor: string) =>
  call<Rect | null>("center_contrib", { monitor }, null);

/** Ensure the contribution widget is visible on some monitor (re-fits it). */
export const ensureContribOnScreen = () =>
  call<Rect | null>("ensure_contrib_on_screen", undefined, null);

// --- GitHub contributions --------------------------------------------------

/** A single day in the contribution grid. */
export interface ContributionDay {
  date: string;
  count: number;
  level: number;
}

/** The contribution graph returned by the backend. */
export interface ContributionGraph {
  username: string;
  total: number;
  longest_streak: number;
  current_streak: number;
  days: ContributionDay[];
}

/**
 * Fetch a GitHub user's contribution graph (public profiles, no auth).
 * Rejects when the backend reports an error so the caller can keep its last
 * known-good graph and retry; returns `null` only in plain-browser mode.
 */
export const getContributions = (username: string) =>
  callStrict<ContributionGraph | null>("get_contributions", { username }, null);

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