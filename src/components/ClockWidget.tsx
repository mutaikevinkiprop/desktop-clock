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
import * as native from "../services/native";
import { useResize } from "../utils/useResize";

export default function ClockWidget() {
  const settings = useSettings((s) => s.settings);
  const loaded = useSettings((s) => s.loaded);
  const rootRef = useRef<HTMLDivElement>(null);

  // Tick at second resolution only when seconds are visible, otherwise per minute.
  const now = useClock(settings.showSeconds ? "second" : "minute");

  // --- Theme variables ------------------------------------------------------
  useEffect(() => {
    if (rootRef.current) applyThemeVariables(settings, rootRef.current);
  }, [settings]);

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

  // --- Resize: remain centered when POSITION is "Center of screen" -----------
  const { onResizeStart } = useResize({
    enabled: settings.resizable,
    min: { width: 200, height: 90 },
    onResizeEnd: async (size) => {
      const store = useSettings.getState();
      store.update({ widgetSize: size });
      // Requirement 14: re-center after resizing while in center mode.
      if (store.settings.positionMode === "center") {
        await native.centerWindow(store.settings.monitor);
      }
    },
  });

  // --- Drag ------------------------------------------------------------------
  const onPointerDown = useCallback(
    async (event: React.PointerEvent) => {
      if (!settings.draggable || settings.clickThrough) return;
      if ((event.target as HTMLElement).closest(".clock-resize-handle")) return;
      if (event.button !== 0) return;
      event.preventDefault();
      await native.startDragging();
      // Persist the resulting position shortly after the drag settles.
      window.setTimeout(async () => {
        const store = useSettings.getState();
        if (store.settings.positionMode !== "custom") {
          // Dragging a centered clock switches the user to a custom position.
          store.update({ positionMode: "custom" });
        }
        await store.saveCurrentPosition();
      }, 280);
    },
    [settings.draggable, settings.clickThrough],
  );

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