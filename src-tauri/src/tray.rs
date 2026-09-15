//! System tray icon and menu.
//!
//! Behaviour:
//! - Left click toggles the widget.
//! - Right click opens the context menu.
//! - The "always on top" and "launch at startup" items are check items whose
//!   state is mirrored from the frontend via `sync_tray_state`.
//!
//! Tauri's `TrayIcon` does not expose a `menu()` getter, so we keep owned
//! handles to the check items in managed state and update them directly.

use tauri::{
    menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, Wry,
};

use crate::window_ops;

pub const TRAY_SHOW: &str = "tray_show";
pub const TRAY_HIDE: &str = "tray_hide";
pub const TRAY_SETTINGS: &str = "tray_settings";
pub const TRAY_ALWAYS_ON_TOP: &str = "tray_always_on_top";
pub const TRAY_AUTOSTART: &str = "tray_autostart";
pub const TRAY_CENTER: &str = "tray_center";
pub const TRAY_EXIT: &str = "tray_exit";

/// Owned handles to the tray's check items, stored in managed state.
struct TrayMenuState {
    always_on_top: CheckMenuItem<Wry>,
    autostart: CheckMenuItem<Wry>,
}

/// Build the tray icon and menu, wiring each item to a frontend event.
pub fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, TRAY_SHOW, "Show Clock", true, None::<&str>)?;
    let hide = MenuItem::with_id(app, TRAY_HIDE, "Hide Clock", true, None::<&str>)?;
    let settings = MenuItem::with_id(app, TRAY_SETTINGS, "Settings...", true, None::<&str>)?;

    let always_on_top = CheckMenuItem::with_id(
        app,
        TRAY_ALWAYS_ON_TOP,
        "Always on Top",
        true,
        false,
        None::<&str>,
    )?;
    let autostart = CheckMenuItem::with_id(
        app,
        TRAY_AUTOSTART,
        "Launch at Startup",
        true,
        false,
        None::<&str>,
    )?;

    let center = MenuItem::with_id(app, TRAY_CENTER, "Center on Screen", true, None::<&str>)?;
    let exit = MenuItem::with_id(app, TRAY_EXIT, "Exit", true, None::<&str>)?;

    let sep1 = PredefinedMenuItem::separator(app)?;
    let sep2 = PredefinedMenuItem::separator(app)?;

    let menu = Menu::with_items(
        app,
        &[
            &show,
            &hide,
            &settings,
            &sep1,
            &always_on_top,
            &autostart,
            &sep2,
            &center,
            &exit,
        ],
    )?;

    // Keep cloned handles so `sync_tray_state` can update the check marks.
    app.manage(TrayMenuState {
        always_on_top: always_on_top.clone(),
        autostart: autostart.clone(),
    });

    let mut builder = TrayIconBuilder::with_id("main-tray").tooltip("Desktop Clock");

    // Reuse the application icon for the tray. If the bundle has no icon we
    // still build the tray (Windows shows a default) rather than failing.
    if let Some(icon) = app.default_window_icon().cloned() {
        builder = builder.icon(icon);
    }

    let _tray = builder
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(move |app, event| match event.id().as_ref() {
            TRAY_SHOW => {
                let _ = window_ops::set_widget_visible(app, true);
                let _ = app.emit("tray://show", ());
            }
            TRAY_HIDE => {
                let _ = window_ops::set_widget_visible(app, false);
                let _ = app.emit("tray://hide", ());
            }
            TRAY_SETTINGS => {
                let _ = window_ops::open_settings_window(app);
            }
            TRAY_ALWAYS_ON_TOP => {
                let checked = always_on_top.is_checked().unwrap_or(false);
                let _ = window_ops::apply_always_on_top(app, checked);
                let _ = app.emit("tray://always-on-top", checked);
            }
            TRAY_AUTOSTART => {
                let checked = autostart.is_checked().unwrap_or(false);
                let _ = crate::startup::set_enabled(app, checked);
                let _ = app.emit("tray://autostart", checked);
            }
            TRAY_CENTER => {
                let _ = window_ops::center_widget(app, "primary");
                let _ = app.emit("tray://centered", ());
            }
            TRAY_EXIT => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                let _ = window_ops::toggle_widget_visibility(app);
                let _ = app.emit("tray://toggled", ());
            }
        })
        .build(app)?;

    Ok(())
}

/// Mirror checkbox state from the frontend into the tray menu.
#[tauri::command]
pub fn sync_tray_state(
    app: AppHandle,
    always_on_top: bool,
    autostart: bool,
) -> Result<(), String> {
    if let Some(state) = app.try_state::<TrayMenuState>() {
        let _ = state.always_on_top.set_checked(always_on_top);
        let _ = state.autostart.set_checked(autostart);
    }
    Ok(())
}