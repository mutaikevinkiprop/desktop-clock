//! Launch-at-startup handling.
//!
//! Uses the Tauri autostart plugin, which registers the application with the
//! native Windows mechanism (a per-user registry Run entry managed by the
//! plugin). This avoids fragile shell/startup-folder workarounds and works
//! correctly for both installed and portable builds.

use tauri::AppHandle;
use tauri_plugin_autostart::ManagerExt;

/// Enable or disable starting with Windows. Returns the resulting state.
pub fn set_enabled(app: &AppHandle, enabled: bool) -> Result<bool, String> {
    let manager = app.autolaunch();
    let result = if enabled {
        manager.enable()
    } else {
        manager.disable()
    };
    result.map_err(|e| e.to_string())?;
    Ok(enabled)
}

/// Query whether the application is registered to start with Windows.
pub fn is_enabled(app: &AppHandle) -> Result<bool, String> {
    app.autolaunch().is_enabled().map_err(|e| e.to_string())
}