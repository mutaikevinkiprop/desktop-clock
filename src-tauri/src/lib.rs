//! Desktop Clock - application bootstrap.
//!
//! Responsibilities of this module:
//! - Register Tauri plugins (store, os, process, global-shortcut, autostart)
//! - Build the system tray
//! - Set up the widget + settings windows
//! - Register all native commands used by the frontend

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
async fn set_global_shortcut(app: tauri::AppHandle, accelerator: Option<String>) -> Result<bool, String> {
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

/// Command: move the widget to an explicit logical position.
#[tauri::command]
async fn set_widget_position(app: tauri::AppHandle, x: i32, y: i32) -> Result<(), String> {
    window_ops::set_widget_position(&app, x, y).map_err(|e| e.to_string())
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
            set_widget_position,
            set_widget_size,
            get_scale_factor,
            quit_app,
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
            match event {
                // Closing the widget hides it instead of exiting; the tray is
                // the canonical way to quit.
                WindowEvent::CloseRequested { api, .. } => {
                    if window.label() == "main" {
                        api.prevent_close();
                        let _ = window.hide();
                    } else if window.label() == "settings" {
                        // Let the settings window really close, but keep the app alive.
                    }
                }
                _ => {}
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
                    }
                }
                _ => {}
            }
        });
}