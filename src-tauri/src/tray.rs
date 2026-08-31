use tauri::{
    menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager,
};
use crate::autostart;
use crate::commands::open_hub_window;

pub fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let is_auto = autostart::is_autostart_enabled().unwrap_or(false);

    let new_note = MenuItem::with_id(app, "new_note", "+ New Note", true, None::<&str>)?;
    let show_hub = MenuItem::with_id(app, "show_hub", "📂 Notes Hub", true, None::<&str>)?;
    let sep1 = PredefinedMenuItem::separator(app)?;
    let show_all = MenuItem::with_id(app, "show_all", "Show All Notes", true, None::<&str>)?;
    let hide_all = MenuItem::with_id(app, "hide_all", "Hide All Notes", true, None::<&str>)?;
    let sep2 = PredefinedMenuItem::separator(app)?;
    let autostart_item = CheckMenuItem::with_id(app, "toggle_autostart", "Launch on Startup", true, is_auto, None::<&str>)?;
    let sep3 = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Exit VibeNotes", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[
        &new_note,
        &show_hub,
        &sep1,
        &show_all,
        &hide_all,
        &sep2,
        &autostart_item,
        &sep3,
        &quit,
    ])?;

    let _tray = TrayIconBuilder::with_id("main-tray")
        .tooltip("VibeNotes - Windows Sticky Notes")
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| {
            match event.id.as_ref() {
                "new_note" => {
                    let app_handle = app.clone();
                    tauri::async_runtime::spawn(async move {
                        let db = app_handle.state::<crate::commands::DbState>();
                        let _ = crate::commands::create_note_helper(&app_handle, &db, None, None, None);
                    });
                }
                "show_hub" => {
                    let app_handle = app.clone();
                    tauri::async_runtime::spawn(async move {
                        let _ = open_hub_window(app_handle).await;
                    });
                }
                "show_all" => {
                    for (_, window) in app.webview_windows() {
                        let _ = window.show();
                    }
                }
                "hide_all" => {
                    for (label, window) in app.webview_windows() {
                        if label != "notes-hub" {
                            let _ = window.hide();
                        }
                    }
                }
                "toggle_autostart" => {
                    let current = autostart::is_autostart_enabled().unwrap_or(false);
                    let _ = autostart::set_autostart(!current);
                }
                "quit" => {
                    app.exit(0);
                }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle().clone();
                tauri::async_runtime::spawn(async move {
                    let _ = open_hub_window(app).await;
                });
            }
        })
        .build(app)?;

    Ok(())
}
