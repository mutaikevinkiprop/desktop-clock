/**
 * ClockWidget - the desktop widget surface.
 *
 * Responsibilities:
 * - Render the clock and apply theme CSS variables.
 * - Handle dragging (native window drag) and resizing (corner grip).
 * - Own the widget lifecycle hooks: startup positioning, ensure-on-screen,
 *   re-centering on resize, and visibility syncing with settings.
 * - Provide the right-click context menu.
 */

import { useCallback, useEffect, useRef } from "react";
import ClockFace from "./ClockFace";
import ContextMenu from "./ContextMenu";
import { useSettings } from "../services/settingsStore";
import { applyThemeVariables } from "../services/themeApply";
import { useClock } from "../utils/useClock";
import { useEffectiveThemeColors } from "../utils/useEffectiveThemeColors";
import * as native from "../services/native";
import { useResize } from "../utils/useResize";

export default function ClockWidget() {
  const settings = useSettings((s) => s.settings);
  const loaded = useSettings((s) => s.loaded);
  const rootRef = useRef<HTMLDivElement>(null);

  // Tick at second resolution only when seconds are visible, otherwise per minute.
  const now = useClock(settings.showSeconds ? "second" : "minute");

  // --- Colour sync ----------------------------------------------------------
  // "rotate" recolours the clock on a timer; "fixed" pins a single palette
  // colour. Both leave the user's own colours untouched when the mode is
  // "off". Shared with the contribution widget so both always render the
  // same colour.
  const { textColor, accentColor } = useEffectiveThemeColors();

  // --- Theme variables ------------------------------------------------------
  useEffect(() => {
    if (!rootRef.current) return;
    applyThemeVariables(
      { ...settings, textColor, accentColor },
      rootRef.current,
    );
  }, [settings, textColor, accentColor]);

  // --- Startup positioning --------------------------------------------------
  // Runs once, after settings have been hydrated from disk.
  const positioned = useRef(false);
  useEffect(() => {
    if (!loaded || positioned.current) return;
    positioned.current = true;
    const store = useSettings.getState();
    void store
      .refreshMonitors()
      .then(() => store.centerOnStartupIfEnabled())
      .then(() => store.applyNativeAll());
  }, [loaded]);

  // --- Display-change watcher ------------------------------------------------
  // Windows does not notify Tauri when the monitor topology changes (docking
  // or undocking, "Second screen only", lid closed), and per-monitor-DPI-aware
  // windows are never auto-moved by the OS. Without this, a display switch can
  // leave the clock stranded on a desktop that is no longer visible. Poll the
  // monitor list cheaply and re-place the clock whenever the layout changes:
  // preset modes re-apply their spot on the configured monitor, custom
  // positions are slid back into view, and the contribution band is re-fit.
  useEffect(() => {
    if (!loaded) return;
    let cancelled = false;
    let lastFingerprint = "";
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      if (cancelled) return;
      try {
        const store = useSettings.getState();
        const monitors = await native.listMonitors();
        const fingerprint = JSON.stringify(monitors);
        if (fingerprint !== lastFingerprint) {
          lastFingerprint = fingerprint;
          store.setMonitors(monitors);
          const { positionMode, contributions } = store.settings;
          if (positionMode === "top" || positionMode === "center") {
            await store.positionNow();
          } else {
            await native.ensureOnScreen();
          }
          // Keep the floating contribution band with the clock.
          if (contributions.enabled) {
            await native.fitContribToClockMonitor();
          }
        }
      } catch {
        /* best-effort */
      }
      if (!cancelled) timer = setTimeout(tick, 2500);
    };

    timer = setTimeout(tick, 2500);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [loaded]);

  // Reflect the stored widget size on the native window.
  useEffect(() => {
    if (!loaded) return;
    void native.setWidgetSize(settings.widgetSize.width, settings.widgetSize.height);
  }, [loaded, settings.widgetSize.width, settings.widgetSize.height]);

  // Keep the native window visibility in sync with the setting.
  useEffect(() => {
    if (!loaded) return;
    void (settings.widgetVisible ? native.showWidget() : native.hideWidget());
  }, [loaded, settings.widgetVisible]);

  // --- Resize: remain positioned when a PRESET position mode is active -------
  const { onResizeStart } = useResize({
    enabled: settings.resizable,
    min: { width: 200, height: 90 },
    onResizeEnd: async (size) => {
      const store = useSettings.getState();
      store.update({ widgetSize: size });
      // Requirement 14: re-position after resizing while in a preset mode.
      if (store.settings.positionMode === "center") {
        await native.centerWindow(store.settings.monitor);
      } else if (store.settings.positionMode === "top") {
        await native.alignTopWindow(store.settings.monitor);
      }
    },
  });

  // --- Drag ------------------------------------------------------------------
  // `startDragging()` resolves immediately - the native drag loop runs on its
  // own thread - so the final position cannot be captured with a fixed timer.
  // Instead, a debounced `Moved` listener (below) persists the position once
  // the window has actually stopped moving.
  const onPointerDown = useCallback(
    async (event: React.PointerEvent) => {
      if (!settings.draggable || settings.clickThrough) return;
      if ((event.target as HTMLElement).closest(".clock-resize-handle")) return;
      if (event.button !== 0) return;
      event.preventDefault();
      const store = useSettings.getState();
      if (store.settings.positionMode !== "custom" || store.settings.centerOnStartup) {
        // Dragging the clock means "keep it here": switch to a custom
        // position and stop auto-centering on the next launch.
        store.update({ positionMode: "custom", centerOnStartup: false });
      }
      await native.startDragging();
    },
    [settings.draggable, settings.clickThrough],
  );

  // Persist the position whenever the window settles after a move (native
  // drag, on-screen snapping, etc.). The debounce saves only the FINAL spot.
  useEffect(() => {
    if (!loaded) return;
    let unlisten: (() => void) | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    (async () => {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        unlisten = await getCurrentWindow().onMoved(() => {
          if (cancelled) return;
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => {
            const store = useSettings.getState();
            // Center mode derives its position, so nothing to persist.
            if (store.settings.positionMode === "custom") {
              void store.saveCurrentPosition();
            }
            // The contribution band lives with the clock: after the window
            // settles (drag, preset re-apply, display change), re-fit the
            // band to the monitor the clock now occupies.
            if (store.settings.contributions.enabled) {
              void native.fitContribToClockMonitor();
            }
          }, 400);
        });
      } catch {
        /* plain browser: no native moves to track */
      }
    })();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (unlisten) unlisten();
    };
  }, [loaded]);

  return (
    <div
      className="clock-root"
      ref={rootRef}
      data-theme={settings.theme}
      onContextMenu={(event) => event.preventDefault()}
    >
      <ContextMenu />
      <div className="clock-face-wrapper">
        <div
          className="clock-drag-region"
          onPointerDown={
            settings.draggable && !settings.clickThrough ? onPointerDown : undefined
          }
          style={{ cursor: settings.draggable ? "grab" : "default" }}
        />
        <ClockFace settings={settings} now={now} />
        {settings.resizable && (
          <>
            {/* Right edge: adjust width only. */}
            <div
              className="clock-resize-handle clock-resize-handle--e"
              data-resize-axis="width"
              onPointerDown={onResizeStart}
              title="Drag to resize width"
              role="separator"
              aria-label="Resize clock width"
            />
            {/* Bottom edge: adjust height only. */}
            <div
              className="clock-resize-handle clock-resize-handle--s"
              data-resize-axis="height"
              onPointerDown={onResizeStart}
              title="Drag to resize height"
              role="separator"
              aria-label="Resize clock height"
            />
            {/* Bottom-right corner: adjust both. */}
            <div
              className="clock-resize-handle clock-resize-handle--se"
              data-resize-axis="both"
              onPointerDown={onResizeStart}
              title="Drag to resize"
              role="separator"
              aria-label="Resize clock"
            />
          </>
        )}
      </div>
    </div>
  );
}