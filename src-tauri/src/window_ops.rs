//! Window management: positioning, precise centering, DPI and multi-monitor.
//!
//! Key correctness rules implemented here:
//! - Centering uses the *real* widget size, never an assumed one:
//!       x = monitor.x + (monitor.width  - widget.width ) / 2
//!       y = monitor.y + (monitor.height - widget.height) / 2
//! - Windows virtual-desktop coordinates may be negative; we never assume 0,0.
//! - Physical vs logical pixels are handled explicitly using each monitor's
//!   scale factor so results are correct at 100%..200%+ display scaling.

use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{
    AppHandle, LogicalPosition, LogicalSize, Manager, PhysicalPosition, WebviewWindow,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

/// The widget window label, referenced in several places.
pub const WIDGET_LABEL: &str = "main";
/// The settings window label.
pub const SETTINGS_LABEL: &str = "settings";

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


/// Resolve a monitor key to a concrete `tauri::Monitor`.
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

/// Set the target used by the global shortcut and re-register nothing else.
pub fn set_center_target(target: &str) {
    if let Ok(mut guard) = CENTER_TARGET.lock() {
        *guard = target.to_string();
    }
}

fn current_center_target() -> String {
    CENTER_TARGET
        .lock()
        .map(|g| g.clone())
        .unwrap_or_default()
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

pub fn set_widget_position(app: &AppHandle, x: i32, y: i32) -> Result<(), String> {
    widget(app)?
        .set_position(LogicalPosition::new(x as f64, y as f64))
        .map_err(|e| e.to_string())
}

pub fn set_widget_size(app: &AppHandle, width: f64, height: f64) -> Result<(), String> {
    let w = widget(app)?;
    w.set_size(LogicalSize::new(width.max(160.0), height.max(80.0)))
        .map_err(|e| e.to_string())
}

/// Ensure the widget is at least partially visible on some monitor. If it is
/// outside every monitor's bounds (e.g. a monitor was unplugged, or the
/// resolution/geometry changed), move it to a safe, visible position.
pub fn ensure_widget_on_screen(app: &AppHandle) -> Result<Rect, String> {
    let w = widget(app)?;
    let pos = w.outer_position().map_err(|e| e.to_string())?;
    let size = w.outer_size().map_err(|e| e.to_string())?;
    let monitors = w.available_monitors().map_err(|e| e.to_string())?;

    let rect = Rect {
        x: pos.x,
        y: pos.y,
        width: size.width as i32,
        height: size.height as i32,
    };

    // Determine whether a meaningful part of the window is inside a monitor.
    const MIN_VISIBLE: i32 = 40;
    let mut best: Option<(i32, tauri::Monitor)> = None;

    for m in monitors.into_iter() {
        let mp = m.position();
        let ms = m.size();
        let mx0 = mp.x as i32;
        let my0 = mp.y as i32;
        let mx1 = mx0 + ms.width as i32;
        let my1 = my0 + ms.height as i32;

        let overlap_x = (rect.x + rect.width).min(mx1) - rect.x.max(mx0);
        let overlap_y = (rect.y + rect.height).min(my1) - rect.y.max(my0);

        if overlap_x >= MIN_VISIBLE && overlap_y >= MIN_VISIBLE {
            return Ok(rect); // Visible enough; nothing to do.
        }

        // Track the monitor whose horizontal intersection is largest so we can
        // clamp the widget into it if we need to relocate it.
        let score = overlap_x.max(0);
        if best.as_ref().map_or(true, |(s, _)| score > *s) {
            best = Some((score, m));
        }
    }

    let Some((_, monitor)) = best else {
        return Ok(rect); // No monitors reported; leave the window alone.
    };

    let mp = monitor.position();
    let ms = monitor.size();
    let cx = mp.x as i32 + (ms.width as i32 - rect.width) / 2;
    let cy = mp.y as i32 + (ms.height as i32 - rect.height) / 2;

    w.set_position(PhysicalPosition::new(cx, cy))
        .map_err(|e| e.to_string())?;

    Ok(Rect {
        x: cx,
        y: cy,
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
pub fn register_center_shortcut(app: &AppHandle, accelerator: Option<String>) -> Result<bool, String> {
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
                let key = if target.is_empty() { "primary" } else { &target };
                let _ = center_widget(&app_handle, key);
            }
        })
        .map_err(|e| e.to_string())?;

    Ok(true)
}