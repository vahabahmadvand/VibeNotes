use std::sync::Arc;
use tauri::{AppHandle, Manager, State, WebviewUrl, WebviewWindowBuilder};
use crate::autostart;
use crate::db::Database;
use crate::models::{Note, UpdateNoteContentPayload};

pub type DbState = Arc<Database>;

#[tauri::command]
pub async fn get_all_notes(db: State<'_, DbState>, include_archived: Option<bool>) -> Result<Vec<Note>, String> {
    db.get_all_notes(include_archived.unwrap_or(false))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_note_by_id(db: State<'_, DbState>, id: String) -> Result<Option<Note>, String> {
    db.get_note_by_id(&id).map_err(|e| e.to_string())
}

pub fn create_note_helper(
    app: &AppHandle,
    db: &Database,
    color_theme: Option<String>,
    x: Option<i32>,
    y: Option<i32>,
) -> Result<Note, String> {
    let note = db.create_note(color_theme, x, y).map_err(|e| e.to_string())?;
    spawn_or_focus_note_window(app, &note)?;
    Ok(note)
}

#[tauri::command]
pub async fn create_new_note(
    app: AppHandle,
    db: State<'_, DbState>,
    color_theme: Option<String>,
    x: Option<i32>,
    y: Option<i32>,
) -> Result<Note, String> {
    create_note_helper(&app, &db, color_theme, x, y)
}

#[tauri::command]
pub async fn save_note_content(
    db: State<'_, DbState>,
    payload: UpdateNoteContentPayload,
) -> Result<(), String> {
    db.update_note_content(
        &payload.id,
        payload.title.as_deref(),
        &payload.content_raw,
        &payload.content_json,
        payload.window_x,
        payload.window_y,
        payload.window_width,
        payload.window_height,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_note_geometry(
    db: State<'_, DbState>,
    id: String,
    x: i32,
    y: i32,
    width: i32,
    height: i32,
) -> Result<(), String> {
    db.update_note_geometry(&id, x, y, width, height)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_note_theme(
    db: State<'_, DbState>,
    id: String,
    color_theme: String,
) -> Result<(), String> {
    db.set_note_theme(&id, &color_theme).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_note_always_on_top(
    app: AppHandle,
    db: State<'_, DbState>,
    id: String,
    always_on_top: bool,
) -> Result<(), String> {
    db.set_note_always_on_top(&id, always_on_top)
        .map_err(|e| e.to_string())?;

    let label = format!("note-{}", id);
    if let Some(window) = app.get_webview_window(&label) {
        let _ = window.set_always_on_top(always_on_top);
    }
    Ok(())
}

#[tauri::command]
pub async fn set_note_pinned(
    db: State<'_, DbState>,
    id: String,
    pinned: bool,
) -> Result<(), String> {
    db.set_note_pinned_status(&id, pinned).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn archive_note(
    app: AppHandle,
    db: State<'_, DbState>,
    id: String,
    is_archived: bool,
) -> Result<(), String> {
    db.set_note_archived(&id, is_archived).map_err(|e| e.to_string())?;
    
    // Close window if archived
    if is_archived {
        let label = format!("note-{}", id);
        if let Some(window) = app.get_webview_window(&label) {
            let _ = window.close();
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn delete_note_permanent(
    app: AppHandle,
    db: State<'_, DbState>,
    id: String,
) -> Result<(), String> {
    db.delete_note_permanent(&id).map_err(|e| e.to_string())?;
    
    let label = format!("note-{}", id);
    if let Some(window) = app.get_webview_window(&label) {
        let _ = window.close();
    }
    Ok(())
}

#[tauri::command]
pub async fn open_note_window(
    app: AppHandle,
    db: State<'_, DbState>,
    id: String,
) -> Result<(), String> {
    let note = db.get_note_by_id(&id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Note not found".to_string())?;

    let _ = db.set_note_open_status(&id, true);
    spawn_or_focus_note_window(&app, &note)
}

#[tauri::command]
pub async fn close_note_window(
    app: AppHandle,
    db: State<'_, DbState>,
    id: String,
) -> Result<(), String> {
    let _ = db.set_note_open_status(&id, false);
    let label = format!("note-{}", id);
    if let Some(window) = app.get_webview_window(&label) {
        let _ = window.close();
    }
    Ok(())
}

#[tauri::command]
pub async fn show_all_notes(app: AppHandle, db: State<'_, DbState>) -> Result<(), String> {
    let notes = db.get_all_notes(false).map_err(|e| e.to_string())?;
    for note in notes {
        let _ = db.set_note_open_status(&note.id, true);
        let _ = spawn_or_focus_note_window(&app, &note);
    }
    Ok(())
}

#[tauri::command]
pub async fn hide_all_notes(app: AppHandle, db: State<'_, DbState>) -> Result<(), String> {
    let notes = db.get_all_notes(false).map_err(|e| e.to_string())?;
    for note in notes {
        let _ = db.set_note_open_status(&note.id, false);
        let label = format!("note-{}", note.id);
        if let Some(window) = app.get_webview_window(&label) {
            let _ = window.close();
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn open_hub_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("notes-hub") {
        let _ = window.show();
        let _ = window.set_focus();
        return Ok(());
    }

    let url = WebviewUrl::App("index.html#/hub".into());
    let _ = WebviewWindowBuilder::new(&app, "notes-hub", url)
        .title("VibeNotes Hub")
        .inner_size(840.0, 620.0)
        .min_inner_size(420.0, 450.0)
        .decorations(false)
        .shadow(true)
        .build()
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn close_hub_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("notes-hub") {
        let _ = window.hide();
    }
    Ok(())
}

#[tauri::command]
pub async fn get_autostart_status() -> Result<bool, String> {
    autostart::is_autostart_enabled()
}

#[tauri::command]
pub async fn toggle_autostart(enable: bool) -> Result<bool, String> {
    autostart::set_autostart(enable)?;
    autostart::is_autostart_enabled()
}

pub fn spawn_or_focus_note_window(app: &AppHandle, note: &Note) -> Result<(), String> {
    let label = format!("note-{}", note.id);

    if let Some(window) = app.get_webview_window(&label) {
        let _ = window.show();
        let _ = window.set_focus();
        return Ok(());
    }

    let route = format!("index.html#/note/{}", note.id);
    let url = WebviewUrl::App(route.into());

    let _window = WebviewWindowBuilder::new(app, &label, url)
        .title(&format!("Sticky Note - {}", note.title))
        .inner_size(note.window_width as f64, note.window_height as f64)
        .position(note.window_x as f64, note.window_y as f64)
        .decorations(false)
        .always_on_top(note.is_always_on_top)
        .min_inner_size(240.0, 240.0)
        .shadow(true)
        .build()
        .map_err(|e| e.to_string())?;

    Ok(())
}
