//! Window management: positioning, precise centering, DPI and multi-monitor.
//!
//! Key correctness rules implemented here:
//! - Centering uses the *real* widget size, never an assumed one:
//!   `x = monitor.x + (monitor.width  - widget.width ) / 2`
//!   `y = monitor.y + (monitor.height - widget.height) / 2`
//! - Windows virtual-desktop coordinates may be negative; we never assume 0,0.
//! - Physical vs logical pixels are handled explicitly using each monitor's
//!   scale factor so results are correct at 100%..200%+ display scaling.

use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, LogicalSize, Manager, PhysicalPosition, WebviewWindow};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

/// The widget window label, referenced in several places.
pub const WIDGET_LABEL: &str = "main";
/// The settings window label.
pub const SETTINGS_LABEL: &str = "settings";
/// The floating contribution-grid widget window label.
pub const CONTRIB_LABEL: &str = "contrib";

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Rect {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitorInfo {
    pub index: usize,
    pub name: Option<String>,
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
    pub scale_factor: f64,
    pub is_primary: bool,
}

/// Tracks the monitor key the shortcut should center on (set by the frontend).
static CENTER_TARGET: Mutex<String> = Mutex::new(String::new());

fn widget(app: &AppHandle) -> Result<WebviewWindow, String> {
    app.get_webview_window(WIDGET_LABEL)
        .ok_or_else(|| "widget window not found".to_string())
}

/// Look up any window by label.
fn win(app: &AppHandle, label: &str) -> Result<WebviewWindow, String> {
    app.get_webview_window(label)
        .ok_or_else(|| format!("window '{label}' not found"))
}

/// Show or hide an arbitrary window WITHOUT focusing it.
///
/// Showing an already-visible window is a no-op, so re-applying settings can
/// never raise the window over whatever the user is currently looking at (e.g.
/// the settings window). This is exactly what the floating contribution widget
/// needs: it renders fine without ever taking focus.
pub fn set_window_visible(app: &AppHandle, label: &str, visible: bool) -> Result<(), String> {
    let w = win(app, label)?;
    if visible {
        if w.is_visible().map_err(|e| e.to_string())? {
            return Ok(()); // Already visible; leave z-order and focus alone.
        }
        w.show().map_err(|e| e.to_string())?;
    } else {
        w.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Whether an arbitrary window is currently visible.
pub fn is_window_visible(app: &AppHandle, label: &str) -> Result<bool, String> {
    win(app, label)?.is_visible().map_err(|e| e.to_string())
}

/// Raise a window to the top of the z-order WITHOUT giving it focus.
///
/// Windows has no direct "raise without activate" API, so we flip the
/// always-on-top flag: entering the topmost band and leaving it again
/// re-inserts the window at the top of the normal band. `keep_on_top`
/// restores the user's always-on-top preference (true = stays topmost).
pub fn raise_window(app: &AppHandle, label: &str, keep_on_top: bool) -> Result<(), String> {
    let w = win(app, label)?;
    if !w.is_visible().map_err(|e| e.to_string())? {
        return Ok(()); // Hidden windows have no z-order position to fix.
    }
    w.set_always_on_top(true).map_err(|e| e.to_string())?;
    if !keep_on_top {
        w.set_always_on_top(false).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Ensure the clock widget sits ABOVE the contribution grid, which is shown
/// after the clock and would otherwise cover it. Never focuses anything, and
/// keeps an open settings window above the clock so editing settings is never
/// obscured by the widgets.
pub fn raise_clock_above_contrib(app: &AppHandle, keep_clock_on_top: bool) -> Result<(), String> {
    raise_window(app, WIDGET_LABEL, keep_clock_on_top)?;
    let settings = win(app, SETTINGS_LABEL)?;
    if settings.is_visible().map_err(|e| e.to_string())? {
        raise_window(app, SETTINGS_LABEL, false)?;
    }
    Ok(())
}

/// Show the contribution grid without disturbing the user's focus.
///
/// `show()` activates the window on Windows (SW_SHOW), so we capture which
/// app window had focus before showing and hand focus straight back after
/// raising the clock above the grid.
pub fn show_contrib_window(app: &AppHandle, keep_clock_on_top: bool) -> Result<(), String> {
    let was_visible = is_window_visible(app, CONTRIB_LABEL)?;

    let focused = app
        .get_webview_window(WIDGET_LABEL)
        .and_then(|w| w.is_focused().ok())
        .unwrap_or(false);
    let settings_focused = app
        .get_webview_window(SETTINGS_LABEL)
        .and_then(|w| w.is_focused().ok())
        .unwrap_or(false);

    // The band lives with the clock: fit it to the monitor the clock is on.
    fit_contrib_to_clock_monitor(app)?;
    set_window_visible(app, CONTRIB_LABEL, true)?;

    if !was_visible {
        raise_clock_above_contrib(app, keep_clock_on_top)?;
        // `show()` moved focus to the grid; restore it to whoever had it.
        if focused {
            win(app, WIDGET_LABEL)?
                .set_focus()
                .map_err(|e| e.to_string())?;
        } else if settings_focused {
            win(app, SETTINGS_LABEL)?
                .set_focus()
                .map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

/// Outer rect of an arbitrary window (physical px).
pub fn window_rect(app: &AppHandle, label: &str) -> Result<Rect, String> {
    let w = win(app, label)?;
    let pos = w.outer_position().map_err(|e| e.to_string())?;
    let size = w.outer_size().map_err(|e| e.to_string())?;
    Ok(Rect {
        x: pos.x,
        y: pos.y,
        width: size.width as i32,
        height: size.height as i32,
    })
}

/// Scale factor of an arbitrary window.
pub fn window_scale_factor(app: &AppHandle, label: &str) -> Result<f64, String> {
    win(app, label)?.scale_factor().map_err(|e| e.to_string())
}

/// Resolve a monitor key to a concrete monitor using an explicit window's
/// context (so it works for any window, not just the clock).
fn resolve_monitor_for(
    _app: &AppHandle,
    w: &WebviewWindow,
    key: &str,
) -> Result<tauri::Monitor, String> {
    let available = w.available_monitors().map_err(|e| e.to_string())?;
    match key {
        "primary" | "auto" | "" => match w.primary_monitor() {
            Ok(Some(m)) => Ok(m),
            _ => available
                .into_iter()
                .next()
                .ok_or_else(|| "no monitors available".to_string()),
        },
        "current" => {
            if let Some(m) = w.current_monitor().map_err(|e| e.to_string())? {
                return Ok(m);
            }
            let pos = w.outer_position().map_err(|e| e.to_string())?;
            match w.monitor_from_point(pos.x as f64, pos.y as f64) {
                Ok(Some(m)) => Ok(m),
                _ => w
                    .primary_monitor()
                    .map_err(|e| e.to_string())?
                    .ok_or_else(|| "no primary monitor".to_string()),
            }
        }
        other => {
            let index: usize = other
                .strip_prefix("index:")
                .and_then(|s| s.parse().ok())
                .ok_or_else(|| format!("invalid monitor key: {other}"))?;
            available
                .into_iter()
                .nth(index)
                .ok_or_else(|| format!("monitor index {index} out of range"))
        }
    }
}

// --- Fixed full-width contribution band -------------------------------------

/// Height of the contribution band as a fraction of the monitor's logical
/// height (clamped to a sane pixel range so it stays usable on tiny and very
/// large displays).
const CONTRIB_HEIGHT_FRACTION: f64 = 0.28;
/// Extra height term driven by the monitor WIDTH. The 53x7 grid spans the full
/// width edge-to-edge, so its natural height grows with the width
/// (~0.13 * width, plus the headline band and padding). Deriving part of the
/// band height from the width guarantees the squares stay flush against the
/// left/right edges without clipping on wider or higher-resolution monitors.
const CONTRIB_WIDTH_FRACTION: f64 = 0.18;
const CONTRIB_HEIGHT_MIN: f64 = 260.0;
const CONTRIB_HEIGHT_MAX: f64 = 930.0;

/// Fit the contribution widget to its monitor:
/// - width  = the monitor's full width (edge to edge),
/// - height = a fixed logical band derived from the monitor's height AND
///   width (so the edge-to-edge grid always fits vertically),
/// - horizontally centered (left edge on the monitor's left edge),
/// - vertically centered on the monitor.
///
/// The window is not resizable, so this is the ONLY size/position source for
/// the widget. The call is idempotent: when the geometry already matches the
/// target (within a pixel) nothing is applied, which keeps settings broadcasts
/// and OS `Moved`/`Resized` events from causing needless move cycles.
pub fn fit_contrib_to_monitor(app: &AppHandle, key: &str) -> Result<Rect, String> {
    let w = win(app, CONTRIB_LABEL)?;
    let monitor = resolve_monitor_for(app, &w, key)?;
    fit_contrib_to(app, &monitor)
}

/// Fit the contribution band to the monitor the CLOCK currently occupies, so
/// the graph always lives with the clock. This is what keeps the band moving
/// with the clock when the display layout changes (e.g. the lid is closed and
/// the clock relocates to the remaining monitor).
pub fn fit_contrib_to_clock_monitor(app: &AppHandle) -> Result<Rect, String> {
    let clock = win(app, WIDGET_LABEL)?;
    let monitor = resolve_monitor_for(app, &clock, "current")?;
    fit_contrib_to(app, &monitor)
}

/// Fit the contribution widget to the given monitor:
/// - width  = the monitor's full width (edge to edge),
/// - height = a fixed logical band derived from the monitor's height AND
///   width (so the edge-to-edge grid always fits vertically),
/// - horizontally centered (left edge on the monitor's left edge),
/// - vertically centered on the monitor.
///
/// The window is not resizable, so this is the ONLY size/position source for
/// the widget. The call is idempotent: when the geometry already matches the
/// target (within a pixel) nothing is applied, which keeps settings broadcasts
/// and OS `Moved`/`Resized` events from causing needless move cycles.
fn fit_contrib_to(app: &AppHandle, monitor: &tauri::Monitor) -> Result<Rect, String> {
    let w = win(app, CONTRIB_LABEL)?;
    let m_pos = monitor.position();
    let m_size = monitor.size();
    let scale = monitor.scale_factor().max(0.5);

    // Logical width/height derived from the monitor's physical size and its
    // own scale factor (correct at 100%..200%+ display scaling).
    let width_logical = m_size.width as f64 / scale;
    let mh_logical = m_size.height as f64 / scale;
    let height_logical = (mh_logical * CONTRIB_HEIGHT_FRACTION)
        .max(width_logical * CONTRIB_WIDTH_FRACTION)
        .clamp(CONTRIB_HEIGHT_MIN, CONTRIB_HEIGHT_MAX);

    let height_physical = (height_logical * scale).round() as i32;
    let x = m_pos.x;
    let y = m_pos.y + (m_size.height as i32 - height_physical) / 2;
    let target = Rect {
        x,
        y,
        width: m_size.width as i32,
        height: height_physical,
    };

    // Skip the OS call when we are already where we need to be.
    if let (Ok(pos), Ok(size)) = (w.outer_position(), w.outer_size()) {
        if (pos.x - x).abs() <= 1
            && (pos.y - y).abs() <= 1
            && (size.width as i32 - target.width).abs() <= 1
            && (size.height as i32 - target.height).abs() <= 1
        {
            return Ok(target);
        }
    }

    w.set_size(LogicalSize::new(width_logical, height_logical))
        .map_err(|e| e.to_string())?;
    w.set_position(PhysicalPosition::new(x, y))
        .map_err(|e| e.to_string())?;
    Ok(target)
}

fn resolve_monitor(app: &AppHandle, key: &str) -> Result<tauri::Monitor, String> {
    let w = widget(app)?;
    let available = w.available_monitors().map_err(|e| e.to_string())?;

    match key {
        "primary" | "auto" | "" => match w.primary_monitor() {
            Ok(Some(m)) => Ok(m),
            // Fall back to the first available monitor if there is no primary.
            _ => available
                .into_iter()
                .next()
                .ok_or_else(|| "no monitors available".to_string()),
        },
        "current" => {
            if let Some(m) = w.current_monitor().map_err(|e| e.to_string())? {
                return Ok(m);
            }
            // If the window is off-screen, Windows still reports a monitor
            // based on its position; if that fails, use the nearest monitor
            // to the window centre, else the primary one.
            let pos = w.outer_position().map_err(|e| e.to_string())?;
            let point = PhysicalPosition::new(pos.x, pos.y);
            match w.monitor_from_point(point.x as f64, point.y as f64) {
                Ok(Some(m)) => Ok(m),
                _ => w
                    .primary_monitor()
                    .map_err(|e| e.to_string())?
                    .ok_or_else(|| "no primary monitor".to_string()),
            }
        }
        other => {
            // "index:N"
            let index: usize = other
                .strip_prefix("index:")
                .and_then(|s| s.parse().ok())
                .ok_or_else(|| format!("invalid monitor key: {other}"))?;
            available
                .into_iter()
                .nth(index)
                .ok_or_else(|| format!("monitor index {index} out of range"))
        }
    }
}

/// Compute the centered rectangle for a monitor without moving the window.
pub fn compute_center_rect(app: &AppHandle, key: &str) -> Result<Rect, String> {
    let w = widget(app)?;
    let monitor = resolve_monitor(app, key)?;

    // Widget size in physical pixels (matches the monitor's coordinate space).
    let win_size = w.outer_size().map_err(|e| e.to_string())?;

    let m_pos = monitor.position();
    let m_size = monitor.size();

    let x = m_pos.x as f64 + (m_size.width as f64 - win_size.width as f64) / 2.0;
    let y = m_pos.y as f64 + (m_size.height as f64 - win_size.height as f64) / 2.0;

    Ok(Rect {
        x: x.round() as i32,
        y: y.round() as i32,
        width: win_size.width as i32,
        height: win_size.height as i32,
    })
}

/// Move the widget to the exact centre of the requested monitor.
pub fn center_widget(app: &AppHandle, key: &str) -> Result<Rect, String> {
    let w = widget(app)?;
    let rect = compute_center_rect(app, key)?;
    w.set_position(PhysicalPosition::new(rect.x, rect.y))
        .map_err(|e| e.to_string())?;
    Ok(rect)
}

/// Gap between the top edge of the monitor and the widget's top edge (logical
/// px). Keeps the widget visually attached to the top without clipping its
/// rounded corners and shadow.
const TOP_MARGIN_LOGICAL: f64 = 12.0;

/// Compute the top-center rectangle for a monitor without moving the window:
/// horizontally centered, pinned just below the monitor's top edge.
pub fn compute_top_rect(app: &AppHandle, key: &str) -> Result<Rect, String> {
    let w = widget(app)?;
    let monitor = resolve_monitor(app, key)?;

    // Widget size in physical pixels (matches the monitor's coordinate space).
    let win_size = w.outer_size().map_err(|e| e.to_string())?;

    let m_pos = monitor.position();
    let m_size = monitor.size();
    let scale = monitor.scale_factor().max(0.5);

    let margin = (TOP_MARGIN_LOGICAL * scale).round() as i32;
    let x = m_pos.x as f64 + (m_size.width as f64 - win_size.width as f64) / 2.0;
    let y = m_pos.y as f64 + margin as f64;

    Ok(Rect {
        x: x.round() as i32,
        y: y.round() as i32,
        width: win_size.width as i32,
        height: win_size.height as i32,
    })
}

/// Move the widget to the top-center of the requested monitor.
pub fn align_top_center(app: &AppHandle, key: &str) -> Result<Rect, String> {
    let w = widget(app)?;
    let rect = compute_top_rect(app, key)?;
    w.set_position(PhysicalPosition::new(rect.x, rect.y))
        .map_err(|e| e.to_string())?;
    Ok(rect)
}

/// Set the target used by the global shortcut and re-register nothing else.
pub fn set_center_target(target: &str) {
    if let Ok(mut guard) = CENTER_TARGET.lock() {
        *guard = target.to_string();
    }
}

fn current_center_target() -> String {
    CENTER_TARGET.lock().map(|g| g.clone()).unwrap_or_default()
}

pub fn list_monitors(app: &AppHandle) -> Result<Vec<MonitorInfo>, String> {
    let w = widget(app)?;
    let available = w.available_monitors().map_err(|e| e.to_string())?;
    let primary_name = w
        .primary_monitor()
        .ok()
        .flatten()
        .and_then(|m| m.name().cloned());

    let mut out = Vec::with_capacity(available.len());
    for (index, m) in available.iter().enumerate() {
        let pos = m.position();
        let size = m.size();
        let is_primary = match (&primary_name, m.name()) {
            (Some(p), Some(n)) => p == n,
            _ => index == 0,
        };
        out.push(MonitorInfo {
            index,
            name: m.name().cloned(),
            x: pos.x,
            y: pos.y,
            width: size.width as i32,
            height: size.height as i32,
            scale_factor: m.scale_factor(),
            is_primary,
        });
    }
    Ok(out)
}

pub fn widget_rect(app: &AppHandle) -> Result<Rect, String> {
    let w = widget(app)?;
    let pos = w.outer_position().map_err(|e| e.to_string())?;
    let size = w.outer_size().map_err(|e| e.to_string())?;
    Ok(Rect {
        x: pos.x,
        y: pos.y,
        width: size.width as i32,
        height: size.height as i32,
    })
}

pub fn widget_scale_factor(app: &AppHandle) -> Result<f64, String> {
    widget(app)?.scale_factor().map_err(|e| e.to_string())
}

/// Restore the widget to a saved PHYSICAL position, guaranteeing the result
/// stays on a visible monitor.
///
/// The position is in physical pixels in Windows virtual-desktop coordinates,
/// which are uniform across monitors regardless of each display's scale
/// factor. Restoring a physical position therefore needs no DPI conversion
/// and cannot drift when the window happens to sit on a different monitor
/// (or at a different scale) than when the position was saved - the original
/// logical-pixel restore drifted by the primary/secondary scale ratio and
/// could land the clock entirely off-screen.
///
/// After moving, the TARGET rect is validated against the monitors directly
/// instead of reading the position back: `set_position` is asynchronous on
/// Windows (`SWP_ASYNCWINDOWPOS`), so a follow-up `GetWindowRect` can still
/// report the pre-move position and let an off-screen restore slip through,
/// leaving the clock invisible.
pub fn restore_widget_position(
    app: &AppHandle,
    x: i32,
    y: i32,
    legacy: bool,
) -> Result<Rect, String> {
    let w = widget(app)?;
    let size = w.outer_size().map_err(|e| e.to_string())?;

    // Settings v1 stored the saved position in LOGICAL pixels; convert to
    // physical using the scale factor of the monitor whose logical bounds
    // contain the point (the monitor the clock was saved on).
    let (x, y) = if legacy {
        convert_legacy_logical_position(&w, x, y)?
    } else {
        (x, y)
    };

    w.set_position(PhysicalPosition::new(x, y))
        .map_err(|e| e.to_string())?;

    // Validate the REQUESTED rect (not a read-back) so the asynchronous
    // SetWindowPos cannot make an off-screen restore slip through the guard.
    ensure_rect_visible(
        app,
        Rect {
            x,
            y,
            width: size.width as i32,
            height: size.height as i32,
        },
    )
}

/// Convert a settings-v1 saved position (logical px) to physical px using the
/// scale factor of the monitor whose logical bounds contain the point.
fn convert_legacy_logical_position(
    w: &WebviewWindow,
    x: i32,
    y: i32,
) -> Result<(i32, i32), String> {
    let monitors = w.available_monitors().map_err(|e| e.to_string())?;
    for m in monitors {
        let scale = m.scale_factor().max(0.5);
        let mp = m.position();
        let ms = m.size();
        let lx0 = mp.x as f64 / scale;
        let ly0 = mp.y as f64 / scale;
        let lx1 = lx0 + ms.width as f64 / scale;
        let ly1 = ly0 + ms.height as f64 / scale;
        let (fx, fy) = (x as f64, y as f64);
        if fx >= lx0 && fx < lx1 && fy >= ly0 && fy < ly1 {
            return Ok(((fx * scale).round() as i32, (fy * scale).round() as i32));
        }
    }
    // Not inside any monitor's logical bounds (unusual layouts): fall back to
    // the window's current scale factor.
    let scale = w.scale_factor().map_err(|e| e.to_string())?.max(0.5);
    Ok((
        (x as f64 * scale).round() as i32,
        (y as f64 * scale).round() as i32,
    ))
}

pub fn set_widget_size(app: &AppHandle, width: f64, height: f64) -> Result<(), String> {
    let w = widget(app)?;
    w.set_size(LogicalSize::new(width.max(160.0), height.max(80.0)))
        .map_err(|e| e.to_string())
}

/// Ensure the widget is at least partially visible on some monitor. If it is
/// outside every monitor's bounds (e.g. a monitor was unplugged, or the
/// resolution/geometry changed), slide it back onto the nearest monitor.
pub fn ensure_widget_on_screen(app: &AppHandle) -> Result<Rect, String> {
    let w = widget(app)?;
    let pos = w.outer_position().map_err(|e| e.to_string())?;
    let size = w.outer_size().map_err(|e| e.to_string())?;
    ensure_rect_visible(
        app,
        Rect {
            x: pos.x,
            y: pos.y,
            width: size.width as i32,
            height: size.height as i32,
        },
    )
}

/// Ensure a widget rect keeps a meaningful part visible on some monitor.
///
/// When it does not, the rect is slid back inside the NEAREST monitor
/// (preserving as much of the intended position as possible) instead of being
/// dumped on the primary: a clock saved just past the edge of a secondary
/// monitor belongs on that secondary, not on the primary. Widgets that cannot
/// fit inside the chosen monitor are centered on it instead.
///
/// Returns the final rect (the input rect when nothing had to move).
fn ensure_rect_visible(app: &AppHandle, rect: Rect) -> Result<Rect, String> {
    let w = widget(app)?;
    let monitors = w.available_monitors().map_err(|e| e.to_string())?;

    // A meaningful part of the window must overlap a monitor.
    const MIN_VISIBLE: i32 = 40;
    // Gap kept between the widget and the monitor edge when sliding back.
    const MARGIN: i32 = 12;

    // Rank monitors by how much of the widget they show, then by distance to
    // the widget's centre, so off-screen restores return to the display they
    // belong to rather than jumping to the primary.
    let mut best: Option<(i32, f64, tauri::Monitor)> = None;

    for m in monitors.into_iter() {
        let mp = m.position();
        let ms = m.size();
        let mx0 = mp.x;
        let my0 = mp.y;
        let mx1 = mx0 + ms.width as i32;
        let my1 = my0 + ms.height as i32;

        let overlap_x = (rect.x + rect.width).min(mx1) - rect.x.max(mx0);
        let overlap_y = (rect.y + rect.height).min(my1) - rect.y.max(my0);

        if overlap_x >= MIN_VISIBLE && overlap_y >= MIN_VISIBLE {
            return Ok(rect); // Visible enough; nothing to do.
        }

        let rect_cx = rect.x as f64 + rect.width as f64 / 2.0;
        let rect_cy = rect.y as f64 + rect.height as f64 / 2.0;
        let m_cx = mx0 as f64 + ms.width as f64 / 2.0;
        let m_cy = my0 as f64 + ms.height as f64 / 2.0;
        let distance = (rect_cx - m_cx).powi(2) + (rect_cy - m_cy).powi(2);
        let score = overlap_x.max(0);
        let better = best.as_ref().map_or(true, |(s, d, _)| {
            score > *s || (score == *s && distance < *d)
        });
        if better {
            best = Some((score, distance, m));
        }
    }

    let Some((_, _, monitor)) = best else {
        return Ok(rect); // No monitors reported; leave the window alone.
    };

    let mp = monitor.position();
    let ms = monitor.size();
    let mx0 = mp.x;
    let my0 = mp.y;

    // Slide the widget back inside the monitor; center it when it cannot fit
    // (widget larger than the monitor).
    let fits_x = rect.width + 2 * MARGIN <= ms.width as i32;
    let fits_y = rect.height + 2 * MARGIN <= ms.height as i32;
    let nx = if fits_x {
        rect.x
            .clamp(mx0 + MARGIN, mx0 + ms.width as i32 - rect.width - MARGIN)
    } else {
        mx0 + (ms.width as i32 - rect.width) / 2
    };
    let ny = if fits_y {
        rect.y
            .clamp(my0 + MARGIN, my0 + ms.height as i32 - rect.height - MARGIN)
    } else {
        my0 + (ms.height as i32 - rect.height) / 2
    };

    w.set_position(PhysicalPosition::new(nx, ny))
        .map_err(|e| e.to_string())?;

    Ok(Rect {
        x: nx,
        y: ny,
        width: rect.width,
        height: rect.height,
    })
}

/// Initial placement used on startup before the frontend restores settings:
/// prefer centering on the primary monitor, clamped to be visible.
pub fn place_widget_initial(w: &WebviewWindow) -> Result<(), String> {
    let monitor = match w.primary_monitor() {
        Ok(Some(m)) => m,
        _ => match w.current_monitor() {
            Ok(Some(m)) => m,
            _ => return Ok(()),
        },
    };
    let size = w.outer_size().map_err(|e| e.to_string())?;
    let mp = monitor.position();
    let ms = monitor.size();
    let x = mp.x as f64 + (ms.width as f64 - size.width as f64) / 2.0;
    let y = mp.y as f64 + (ms.height as f64 - size.height as f64) / 2.0;
    w.set_position(PhysicalPosition::new(x.round() as i32, y.round() as i32))
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub fn set_widget_visible(app: &AppHandle, visible: bool) -> Result<(), String> {
    let w = widget(app)?;
    if visible {
        w.show().map_err(|e| e.to_string())?;
        w.set_focus().map_err(|e| e.to_string())?;
    } else {
        w.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn toggle_widget_visibility(app: &AppHandle) -> Result<bool, String> {
    let w = widget(app)?;
    let visible = w.is_visible().map_err(|e| e.to_string())?;
    if visible {
        w.hide().map_err(|e| e.to_string())?;
        Ok(false)
    } else {
        w.show().map_err(|e| e.to_string())?;
        Ok(true)
    }
}

pub fn apply_always_on_top(app: &AppHandle, enabled: bool) -> Result<(), String> {
    widget(app)?
        .set_always_on_top(enabled)
        .map_err(|e| e.to_string())
}

pub fn apply_click_through(app: &AppHandle, enabled: bool) -> Result<(), String> {
    widget(app)?
        .set_ignore_cursor_events(enabled)
        .map_err(|e| e.to_string())
}

pub fn apply_resizable(app: &AppHandle, enabled: bool) -> Result<(), String> {
    widget(app)?
        .set_resizable(enabled)
        .map_err(|e| e.to_string())
}

/// Open (or focus) the settings window.
pub fn open_settings_window(app: &AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window(SETTINGS_LABEL) {
        win.show().map_err(|e| e.to_string())?;
        win.unminimize().map_err(|e| e.to_string())?;
        win.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    tauri::WebviewWindowBuilder::new(
        app,
        SETTINGS_LABEL,
        tauri::WebviewUrl::App("index.html?window=settings".into()),
    )
    .title("Desktop Clock - Settings")
    .inner_size(880.0, 640.0)
    .min_inner_size(720.0, 520.0)
    .resizable(true)
    .decorations(true)
    .center()
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}

pub fn close_settings_window(app: &AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window(SETTINGS_LABEL) {
        win.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Register the global shortcut that triggers centering.
///
/// `accelerator` is e.g. `"Ctrl+Alt+KeyC"`; `None` or an empty string disables it.
pub fn register_center_shortcut(
    app: &AppHandle,
    accelerator: Option<String>,
) -> Result<bool, String> {
    let manager = app.global_shortcut();

    // Always clear previously registered shortcuts first.
    let _ = manager.unregister_all();

    let Some(accel) = accelerator.filter(|s| !s.trim().is_empty()) else {
        return Ok(false);
    };

    let shortcut: Shortcut = accel
        .parse()
        .map_err(|e| format!("invalid accelerator '{accel}': {e}"))?;

    let app_handle = app.clone();
    manager
        .on_shortcut(shortcut, move |_app, _shortcut, event| {
            if event.state() == ShortcutState::Pressed {
                let target = current_center_target();
                let key = if target.is_empty() {
                    "primary"
                } else {
                    &target
                };
                let _ = center_widget(&app_handle, key);
            }
        })
        .map_err(|e| e.to_string())?;

    Ok(true)
}
