//! Desktop Clock - application bootstrap.
//!
//! Responsibilities of this module:
//! - Register Tauri plugins (store, os, process, global-shortcut, autostart)
//! - Build the system tray
//! - Set up the widget + settings windows
//! - Register all native commands used by the frontend

mod contributions;
mod startup;
mod tray;
mod window_ops;

use tauri::{Manager, RunEvent, WindowEvent};

/// Command: reveal and focus the settings window, creating it if necessary.
#[tauri::command]
async fn open_settings(app: tauri::AppHandle) -> Result<(), String> {
    window_ops::open_settings_window(&app).map_err(|e| e.to_string())
}

/// Command: close (hide) the settings window.
#[tauri::command]
async fn close_settings(app: tauri::AppHandle) -> Result<(), String> {
    window_ops::close_settings_window(&app).map_err(|e| e.to_string())
}

/// Command: show the widget window.
#[tauri::command]
async fn show_widget(app: tauri::AppHandle) -> Result<(), String> {
    window_ops::set_widget_visible(&app, true).map_err(|e| e.to_string())
}

/// Command: hide the widget window.
#[tauri::command]
async fn hide_widget(app: tauri::AppHandle) -> Result<(), String> {
    window_ops::set_widget_visible(&app, false).map_err(|e| e.to_string())
}

/// Command: toggle widget visibility, returning the new visibility state.
#[tauri::command]
async fn toggle_widget(app: tauri::AppHandle) -> Result<bool, String> {
    window_ops::toggle_widget_visibility(&app).map_err(|e| e.to_string())
}

/// Command: center the widget on the requested monitor and return its new rect.
///
/// `monitor` accepts one of:
/// - `"primary"`  -> the OS primary monitor
/// - `"current"`  -> the monitor the widget currently occupies
/// - `"index:N"`  -> the Nth monitor from `available_monitors()`
/// - `"auto"`     -> fall back to primary
#[tauri::command]
async fn center_window(
    app: tauri::AppHandle,
    monitor: Option<String>,
) -> Result<window_ops::Rect, String> {
    let key = monitor.unwrap_or_else(|| "primary".to_string());
    window_ops::center_widget(&app, &key).map_err(|e| e.to_string())
}

/// Command: compute (without applying) the centered rect for a monitor.
#[tauri::command]
async fn compute_center(
    app: tauri::AppHandle,
    monitor: Option<String>,
) -> Result<window_ops::Rect, String> {
    let key = monitor.unwrap_or_else(|| "primary".to_string());
    window_ops::compute_center_rect(&app, &key).map_err(|e| e.to_string())
}

/// Command: align the widget to the top-center of the requested monitor and
/// return its new rect. Accepts the same monitor keys as `center_window`.
#[tauri::command]
async fn align_top_center(
    app: tauri::AppHandle,
    monitor: Option<String>,
) -> Result<window_ops::Rect, String> {
    let key = monitor.unwrap_or_else(|| "primary".to_string());
    window_ops::align_top_center(&app, &key).map_err(|e| e.to_string())
}

/// Command: list monitors with their logical geometry so the UI can present them.
#[tauri::command]
async fn list_monitors(app: tauri::AppHandle) -> Result<Vec<window_ops::MonitorInfo>, String> {
    window_ops::list_monitors(&app).map_err(|e| e.to_string())
}

/// Command: ensure the widget sits fully inside a visible monitor.
#[tauri::command]
async fn ensure_on_screen(app: tauri::AppHandle) -> Result<window_ops::Rect, String> {
    window_ops::ensure_widget_on_screen(&app).map_err(|e| e.to_string())
}

/// Command: apply always-on-top to the widget.
#[tauri::command]
async fn set_always_on_top(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    window_ops::apply_always_on_top(&app, enabled).map_err(|e| e.to_string())
}

/// Command: apply click-through (ignore cursor events) to the widget.
#[tauri::command]
async fn set_click_through(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    window_ops::apply_click_through(&app, enabled).map_err(|e| e.to_string())
}

/// Command: apply resizable / draggable-related window flags.
#[tauri::command]
async fn set_resizable(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    window_ops::apply_resizable(&app, enabled).map_err(|e| e.to_string())
}

/// Command: enable or disable launch-at-startup.
#[tauri::command]
async fn set_autostart(app: tauri::AppHandle, enabled: bool) -> Result<bool, String> {
    startup::set_enabled(&app, enabled)
}

/// Command: query the current launch-at-startup state.
#[tauri::command]
async fn get_autostart(app: tauri::AppHandle) -> Result<bool, String> {
    startup::is_enabled(&app)
}

/// Command: register (or re-register) the global "center clock" shortcut.
#[tauri::command]
async fn set_global_shortcut(
    app: tauri::AppHandle,
    accelerator: Option<String>,
) -> Result<bool, String> {
    window_ops::register_center_shortcut(&app, accelerator)
}

/// Command: set which monitor the global shortcut centers on.
#[tauri::command]
async fn set_center_target(target: String) -> Result<(), String> {
    window_ops::set_center_target(&target);
    Ok(())
}

/// Command: return the widget's outer position and inner size (logical pixels).
#[tauri::command]
async fn get_widget_rect(app: tauri::AppHandle) -> Result<window_ops::Rect, String> {
    window_ops::widget_rect(&app).map_err(|e| e.to_string())
}

/// Command: restore the widget to its saved PHYSICAL position, sliding it back
/// onto a visible monitor when the saved spot is now off-screen (monitor
/// removed, resolution changed, DPI change between sessions).
///
/// `legacy` marks coordinates written by settings v1, which stored LOGICAL
/// pixels; the backend converts those with the correct monitor scale factor.
#[tauri::command]
async fn restore_widget_position(
    app: tauri::AppHandle,
    x: i32,
    y: i32,
    legacy: Option<bool>,
) -> Result<window_ops::Rect, String> {
    window_ops::restore_widget_position(&app, x, y, legacy.unwrap_or(false))
        .map_err(|e| e.to_string())
}

/// Command: resize the widget to an explicit logical size.
#[tauri::command]
async fn set_widget_size(app: tauri::AppHandle, width: f64, height: f64) -> Result<(), String> {
    window_ops::set_widget_size(&app, width, height).map_err(|e| e.to_string())
}

/// Command: return the OS scale factor for the widget window.
#[tauri::command]
async fn get_scale_factor(app: tauri::AppHandle) -> Result<f64, String> {
    window_ops::widget_scale_factor(&app).map_err(|e| e.to_string())
}

/// Command: quit the whole application.
#[tauri::command]
async fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

/// Command: fetch a GitHub user's contribution graph for the wallpaper.
///
/// Runs the blocking HTTP request on a background thread so the UI thread
/// (and the IPC bridge) stay responsive.
#[tauri::command]
async fn get_contributions(username: String) -> Result<contributions::ContributionGraph, String> {
    tauri::async_runtime::spawn_blocking(move || contributions::fetch(&username))
        .await
        .map_err(|e| e.to_string())?
}

// ---------------------------------------------------------------------------
// Contribution widget window (a floating widget, like the clock).
// ---------------------------------------------------------------------------

/// Command: show the floating contribution widget (fitted to the monitor,
/// never stealing focus, with the clock raised above the grid).
#[tauri::command]
async fn show_contrib(
    app: tauri::AppHandle,
    keep_clock_on_top: Option<bool>,
) -> Result<(), String> {
    window_ops::show_contrib_window(&app, keep_clock_on_top.unwrap_or(false))
}

/// Command: hide the floating contribution widget.
#[tauri::command]
async fn hide_contrib(app: tauri::AppHandle) -> Result<(), String> {
    window_ops::set_window_visible(&app, window_ops::CONTRIB_LABEL, false)
}

/// Command: apply the drawing/visibility options to the contrib window.
/// `visible` toggles it; the window itself reads the rest from the store.
/// When showing, the widget is first forced to its fixed full-width size and
/// the clock is raised back above it. Focus is preserved (never stolen), so
/// editing settings is never interrupted by the widget.
#[tauri::command]
async fn sync_contrib(
    app: tauri::AppHandle,
    visible: bool,
    keep_clock_on_top: Option<bool>,
) -> Result<(), String> {
    if visible {
        window_ops::show_contrib_window(&app, keep_clock_on_top.unwrap_or(false))?;
    } else {
        window_ops::set_window_visible(&app, window_ops::CONTRIB_LABEL, false)?;
    }
    Ok(())
}

/// Command: fit the contrib widget to its monitor's full width (fixed,
/// non-resizable band). Accepts the same monitor keys as `center_window`;
/// defaults to the monitor the window currently lives on.
#[tauri::command]
async fn fit_contrib_to_monitor(
    app: tauri::AppHandle,
    monitor: Option<String>,
) -> Result<window_ops::Rect, String> {
    let key = monitor.unwrap_or_else(|| "current".to_string());
    window_ops::fit_contrib_to_monitor(&app, &key)
}

/// Command: fit the contribution band to the monitor the CLOCK is currently
/// on, so the graph always follows the clock (display changes included).
#[tauri::command]
async fn fit_contrib_to_clock(app: tauri::AppHandle) -> Result<window_ops::Rect, String> {
    window_ops::fit_contrib_to_clock_monitor(&app)
}

/// Command: the contrib widget's outer rect (physical px).
#[tauri::command]
async fn get_contrib_rect(app: tauri::AppHandle) -> Result<window_ops::Rect, String> {
    window_ops::window_rect(&app, window_ops::CONTRIB_LABEL)
}

/// Command: the scale factor of the contrib widget's monitor.
#[tauri::command]
async fn get_contrib_scale(app: tauri::AppHandle) -> Result<f64, String> {
    window_ops::window_scale_factor(&app, window_ops::CONTRIB_LABEL)
}

/// Command: center the contrib widget on a monitor key (kept for backwards
/// compatibility; the widget is always fitted to the full monitor width).
#[tauri::command]
async fn center_contrib(
    app: tauri::AppHandle,
    monitor: Option<String>,
) -> Result<window_ops::Rect, String> {
    let key = monitor.unwrap_or_else(|| "primary".to_string());
    window_ops::fit_contrib_to_monitor(&app, &key)
}

/// Command: ensure the contrib widget is visible on some monitor (kept for
/// backwards compatibility; fitting always places it fully on the monitor).
#[tauri::command]
async fn ensure_contrib_on_screen(app: tauri::AppHandle) -> Result<window_ops::Rect, String> {
    window_ops::fit_contrib_to_monitor(&app, "current")
}

pub fn run() {
    tauri::Builder::default()
        // --- Plugins ---------------------------------------------------------
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--autostart"]),
        ))
        // --- Commands --------------------------------------------------------
        .invoke_handler(tauri::generate_handler![
            open_settings,
            close_settings,
            show_widget,
            hide_widget,
            toggle_widget,
            center_window,
            compute_center,
            align_top_center,
            list_monitors,
            ensure_on_screen,
            set_always_on_top,
            set_click_through,
            set_resizable,
            set_autostart,
            get_autostart,
            set_global_shortcut,
            set_center_target,
            get_widget_rect,
            restore_widget_position,
            set_widget_size,
            get_scale_factor,
            quit_app,
            get_contributions,
            show_contrib,
            hide_contrib,
            sync_contrib,
            fit_contrib_to_monitor,
            fit_contrib_to_clock,
            get_contrib_rect,
            get_contrib_scale,
            center_contrib,
            ensure_contrib_on_screen,
            tray::sync_tray_state,
        ])
        // --- Setup -----------------------------------------------------------
        .setup(|app| {
            tray::build_tray(app.handle())?;

            // Apply safe defaults; the frontend restores the real settings and
            // calls back into the native layer once it has loaded.
            if let Some(widget) = app.get_webview_window("main") {
                let _ = widget.set_always_on_top(false);
                let _ = widget.set_ignore_cursor_events(false);
            }

            // The contribution widget is a fixed, non-resizable band. Enforce
            // this at runtime regardless of what an older config/settings file
            // might have requested.
            if let Some(contrib) = app.get_webview_window("contrib") {
                let _ = contrib.set_resizable(false);
                let _ = window_ops::fit_contrib_to_clock_monitor(app.handle());
            }

            // Show the widget immediately on first launch; positioning is
            // finalized by the frontend once settings are restored.
            if let Some(widget) = app.get_webview_window("main") {
                let _ = window_ops::place_widget_initial(&widget);
                let _ = widget.show();
            }

            Ok(())
        })
        // --- Runtime events --------------------------------------------------
        .on_window_event(|window, event| {
            // Closing the widget hides it instead of exiting; the tray is
            // the canonical way to quit.
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                } else if window.label() == "settings" {
                    // Let the settings window really close, but keep the app alive.
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building desktop-clock")
        .run(|app, event| {
            match event {
                // Keep running in the tray when all windows are hidden/closed.
                RunEvent::ExitRequested { api, code, .. } => {
                    if code.is_none() {
                        api.prevent_exit();
                    }
                }
                // Re-validate the widget position whenever the display
                // configuration may have changed.
                RunEvent::WindowEvent { label, event, .. } => {
                    if label == "main" {
                        if let WindowEvent::ScaleFactorChanged { .. } = event {
                            let _ = window_ops::ensure_widget_on_screen(app);
                        }
                    } else if label == "contrib" {
                        // The contrib band lives with the clock: re-fit it to
                        // the clock's monitor whenever the OS moves/resizes it
                        // (display change, DPI change). The fit is idempotent,
                        // so our own set_position/set_size cannot loop back
                        // through these events.
                        if matches!(
                            event,
                            WindowEvent::ScaleFactorChanged { .. }
                                | WindowEvent::Moved(_)
                                | WindowEvent::Resized(_)
                        ) {
                            let _ = window_ops::fit_contrib_to_clock_monitor(app);
                        }
                    }
                }
                _ => {}
            }
        });
}
