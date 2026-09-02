pub mod autostart;
pub mod commands;
pub mod db;
pub mod mcp;
pub mod models;
pub mod tray;

use std::sync::Arc;
use tauri::Manager;
use db::Database;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db = match Database::new() {
        Ok(d) => Arc::new(d),
        Err(e) => {
            eprintln!("Failed to initialize SQLite database: {}", e);
            std::process::exit(1);
        }
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(db.clone())
        .invoke_handler(tauri::generate_handler![
            commands::get_all_notes,
            commands::get_note_by_id,
            commands::create_new_note,
            commands::save_note_content,
            commands::update_note_geometry,
            commands::set_note_theme,
            commands::set_note_always_on_top,
            commands::set_note_pinned,
            commands::archive_note,
            commands::delete_note_permanent,
            commands::open_note_window,
            commands::close_note_window,
            commands::show_all_notes,
            commands::hide_all_notes,
            commands::open_hub_window,
            commands::close_hub_window,
            commands::get_autostart_status,
            commands::toggle_autostart,
            commands::open_external_url,
        ])
        .setup(move |app| {
            let app_handle = app.handle().clone();

            // Set up native Windows System Tray
            if let Err(e) = tray::setup_tray(&app_handle) {
                eprintln!("Failed to setup system tray: {}", e);
            }

            // Check if launched with --minimized flag (e.g. from Windows Startup)
            let args: Vec<String> = std::env::args().collect();
            let is_minimized = args.iter().any(|arg| arg == "--minimized");

            // Restore active open notes
            let db_ref = app_handle.state::<commands::DbState>();
            let open_notes = db_ref.get_active_open_notes().unwrap_or_default();

            if !open_notes.is_empty() {
                for note in open_notes {
                    let _ = commands::spawn_or_focus_note_window(&app_handle, &note);
                }
            } else if !is_minimized {
                // If no notes are currently open, check if any notes exist in the DB
                let all_notes = db_ref.get_all_notes(false).unwrap_or_default();
                if let Some(recent_note) = all_notes.first() {
                    // Restore the most recently edited note rather than creating a new blank note
                    let _ = db_ref.set_note_open_status(&recent_note.id, true);
                    let _ = commands::spawn_or_focus_note_window(&app_handle, recent_note);
                } else {
                    // First time launch on a completely empty database: create initial welcome note
                    let app_h = app_handle.clone();
                    tauri::async_runtime::spawn(async move {
                        let db_state = app_h.state::<commands::DbState>();
                        let _ = commands::create_note_helper(&app_h, &db_state, Some("yellow".to_string()), Some(200), Some(150));
                    });
                }
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running VibeNotes");
}
