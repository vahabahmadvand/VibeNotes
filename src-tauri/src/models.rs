use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Note {
    pub id: String,
    pub title: String,
    pub content_raw: String,
    pub content_json: String,
    pub color_theme: String,
    pub is_always_on_top: bool,
    pub is_open: bool,
    pub is_pinned: bool,
    pub is_archived: bool,
    pub window_x: i32,
    pub window_y: i32,
    pub window_width: i32,
    pub window_height: i32,
    pub z_order: i32,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateNotePayload {
    pub title: Option<String>,
    pub content_raw: Option<String>,
    pub content_json: Option<String>,
    pub color_theme: Option<String>,
    pub window_x: Option<i32>,
    pub window_y: Option<i32>,
    pub window_width: Option<i32>,
    pub window_height: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateNoteContentPayload {
    pub id: String,
    pub title: Option<String>,
    pub content_raw: String,
    pub content_json: String,
    pub window_x: Option<i32>,
    pub window_y: Option<i32>,
    pub window_width: Option<i32>,
    pub window_height: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteWindowGeometry {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}
