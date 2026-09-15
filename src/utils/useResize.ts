/**
 * `useResize` - resizes the current Tauri window from a drag handle.
 *
 * Implementation notes:
 * - Window size is read from the native layer in physical pixels and converted
 *   to logical pixels using the monitor scale factor, so dragging feels the
 *   same at 100%, 150% and 200% display scaling.
 * - `pointermove`/`pointerup` listeners live on `window`, so the drag continues
 *   even if the cursor briefly leaves the widget.
 * - On release we report the FINAL logical size to the caller, which can then
 *   persist it and re-center if the widget is in center mode.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { getScaleFactor, setWidgetSize } from "../services/native";

interface Size {
  width: number;
  height: number;
}

/** Which edges a drag handle controls. */
export type ResizeAxis = "both" | "width" | "height";

interface UseResizeOptions {
  enabled: boolean;
  min: Size;
  max?: Size;
  onResizeEnd?: (size: Size) => void | Promise<void>;
}

export function useResize({ enabled, min, max, onResizeEnd }: UseResizeOptions) {
  const [resizing, setResizing] = useState(false);
  const stateRef = useRef<{
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    scale: number;
    axis: ResizeAxis;
    last: Size;
  } | null>(null);

  const optionsRef = useRef({ min, max, onResizeEnd });
  optionsRef.current = { min, max, onResizeEnd };

  const onResizeStart = useCallback(
    async (event: React.PointerEvent) => {
      if (!enabled) return;
      event.preventDefault();
      event.stopPropagation();

      let startWidth = window.innerWidth;
      let startHeight = window.innerHeight;
      let scale = 1;

      const [factor, physical] = await Promise.all([
        getScaleFactor().catch(() => 1),
        import("@tauri-apps/api/window")
          .then((m) => m.getCurrentWindow().innerSize())
          .catch(() => null),
      ]);

      scale = factor > 0 ? factor : 1;
      if (physical) {
        startWidth = physical.width / scale;
        startHeight = physical.height / scale;
      }

      const axis = (event.currentTarget as HTMLElement)?.dataset
        ?.resizeAxis as ResizeAxis | undefined;

      stateRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        startWidth,
        startHeight,
        scale,
        axis: axis ?? "both",
        last: { width: Math.round(startWidth), height: Math.round(startHeight) },
      };
      setResizing(true);
    },
    [enabled],
  );

  useEffect(() => {
    if (!resizing) return;

    let frame = 0;

    const onMove = (event: PointerEvent) => {
      const state = stateRef.current;
      if (!state) return;

      const { min: minSize, max: maxSize } = optionsRef.current;
      const scale = state.scale > 0 ? state.scale : 1;
      const dx = (event.clientX - state.startX) / scale;
      const dy = (event.clientY - state.startY) / scale;

      const axis = state.axis;
      let width = axis === "height" ? state.startWidth : state.startWidth + dx;
      let height = axis === "width" ? state.startHeight : state.startHeight + dy;

      width = Math.max(minSize.width, width);
      height = Math.max(minSize.height, height);
      if (maxSize) {
        width = Math.min(maxSize.width, width);
        height = Math.min(maxSize.height, height);
      }

      state.last = { width: Math.round(width), height: Math.round(height) };

      // Coalesce native calls to one per animation frame.
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        void setWidgetSize(width, height);
      });
    };

    const finish = () => {
      const state = stateRef.current;
      stateRef.current = null;
      setResizing(false);
      if (state) void optionsRef.current.onResizeEnd?.(state.last);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
    };
  }, [resizing]);

  return { onResizeStart, resizing };
}