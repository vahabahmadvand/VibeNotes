use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use rusqlite::{params, Connection, Result};
use chrono::Utc;
use uuid::Uuid;
use crate::models::Note;

pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    pub fn new() -> Result<Self, Box<dyn std::error::Error>> {
        let db_dir = dirs::data_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("VibeNotes");
        
        fs::create_dir_all(&db_dir)?;
        let db_path = db_dir.join("vibenotes.db");

        let conn = Connection::open(&db_path)?;

        // WAL mode for fast concurrency & crash resilience
        conn.execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA synchronous = NORMAL;
             PRAGMA foreign_keys = ON;
             PRAGMA busy_timeout = 5000;"
        )?;

        // Create tables
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS notes (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                content_raw TEXT NOT NULL,
                content_json TEXT NOT NULL,
                color_theme TEXT NOT NULL DEFAULT 'yellow',
                is_always_on_top INTEGER NOT NULL DEFAULT 0,
                is_open INTEGER NOT NULL DEFAULT 1,
                is_pinned INTEGER NOT NULL DEFAULT 0,
                is_archived INTEGER NOT NULL DEFAULT 0,
                window_x INTEGER NOT NULL DEFAULT 120,
                window_y INTEGER NOT NULL DEFAULT 120,
                window_width INTEGER NOT NULL DEFAULT 340,
                window_height INTEGER NOT NULL DEFAULT 400,
                z_order INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS attachments (
                id TEXT PRIMARY KEY,
                note_id TEXT NOT NULL,
                file_path TEXT NOT NULL,
                mime_type TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                FOREIGN KEY(note_id) REFERENCES notes(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at DESC);
            CREATE INDEX IF NOT EXISTS idx_notes_status ON notes(is_open, is_archived);"
        )?;

        Ok(Database {
            conn: Mutex::new(conn),
        })
    }

    pub fn get_all_notes(&self, include_archived: bool) -> Result<Vec<Note>, rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        let query = if include_archived {
            "SELECT id, title, content_raw, content_json, color_theme, is_always_on_top, is_open, is_pinned, is_archived, window_x, window_y, window_width, window_height, z_order, created_at, updated_at FROM notes ORDER BY is_pinned DESC, updated_at DESC"
        } else {
            "SELECT id, title, content_raw, content_json, color_theme, is_always_on_top, is_open, is_pinned, is_archived, window_x, window_y, window_width, window_height, z_order, created_at, updated_at FROM notes WHERE is_archived = 0 ORDER BY is_pinned DESC, updated_at DESC"
        };

        let mut stmt = conn.prepare(query)?;
        let rows = stmt.query_map([], |row| {
            Ok(Note {
                id: row.get(0)?,
                title: row.get(1)?,
                content_raw: row.get(2)?,
                content_json: row.get(3)?,
                color_theme: row.get(4)?,
                is_always_on_top: row.get::<_, i32>(5)? != 0,
                is_open: row.get::<_, i32>(6)? != 0,
                is_pinned: row.get::<_, i32>(7)? != 0,
                is_archived: row.get::<_, i32>(8)? != 0,
                window_x: row.get(9)?,
                window_y: row.get(10)?,
                window_width: row.get(11)?,
                window_height: row.get(12)?,
                z_order: row.get(13)?,
                created_at: row.get(14)?,
                updated_at: row.get(15)?,
            })
        })?;

        let mut notes = Vec::new();
        for note in rows {
            notes.push(note?);
        }
        Ok(notes)
    }

    pub fn get_active_open_notes(&self) -> Result<Vec<Note>, rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, title, content_raw, content_json, color_theme, is_always_on_top, is_open, is_pinned, is_archived, window_x, window_y, window_width, window_height, z_order, created_at, updated_at FROM notes WHERE is_open = 1 AND is_archived = 0 ORDER BY updated_at ASC"
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(Note {
                id: row.get(0)?,
                title: row.get(1)?,
                content_raw: row.get(2)?,
                content_json: row.get(3)?,
                color_theme: row.get(4)?,
                is_always_on_top: row.get::<_, i32>(5)? != 0,
                is_open: row.get::<_, i32>(6)? != 0,
                is_pinned: row.get::<_, i32>(7)? != 0,
                is_archived: row.get::<_, i32>(8)? != 0,
                window_x: row.get(9)?,
                window_y: row.get(10)?,
                window_width: row.get(11)?,
                window_height: row.get(12)?,
                z_order: row.get(13)?,
                created_at: row.get(14)?,
                updated_at: row.get(15)?,
            })
        })?;

        let mut notes = Vec::new();
        for note in rows {
            notes.push(note?);
        }
        Ok(notes)
    }

    pub fn get_note_by_id(&self, id: &str) -> Result<Option<Note>, rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, title, content_raw, content_json, color_theme, is_always_on_top, is_open, is_pinned, is_archived, window_x, window_y, window_width, window_height, z_order, created_at, updated_at FROM notes WHERE id = ?1"
        )?;

        let mut rows = stmt.query_map(params![id], |row| {
            Ok(Note {
                id: row.get(0)?,
                title: row.get(1)?,
                content_raw: row.get(2)?,
                content_json: row.get(3)?,
                color_theme: row.get(4)?,
                is_always_on_top: row.get::<_, i32>(5)? != 0,
                is_open: row.get::<_, i32>(6)? != 0,
                is_pinned: row.get::<_, i32>(7)? != 0,
                is_archived: row.get::<_, i32>(8)? != 0,
                window_x: row.get(9)?,
                window_y: row.get(10)?,
                window_width: row.get(11)?,
                window_height: row.get(12)?,
                z_order: row.get(13)?,
                created_at: row.get(14)?,
                updated_at: row.get(15)?,
            })
        })?;

        if let Some(note) = rows.next() {
            Ok(Some(note?))
        } else {
            Ok(None)
        }
    }

    pub fn create_note(&self, color_theme: Option<String>, x: Option<i32>, y: Option<i32>) -> Result<Note, rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().timestamp_millis();
        let theme = color_theme.unwrap_or_else(|| "yellow".to_string());
        
        let win_x = x.unwrap_or(150);
        let win_y = y.unwrap_or(150);
        let win_w = 340;
        let win_h = 400;

        let initial_json = r#"{"type":"doc","content":[{"type":"paragraph"}]}"#;

        conn.execute(
            "INSERT INTO notes (
                id, title, content_raw, content_json, color_theme,
                is_always_on_top, is_open, is_pinned, is_archived,
                window_x, window_y, window_width, window_height,
                z_order, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, 0, 1, 0, 0, ?6, ?7, ?8, ?9, 0, ?10, ?11)",
            params![
                id,
                "Untitled Note",
                "",
                initial_json,
                theme,
                win_x,
                win_y,
                win_w,
                win_h,
                now,
                now
            ],
        )?;

        Ok(Note {
            id,
            title: "Untitled Note".to_string(),
            content_raw: "".to_string(),
            content_json: initial_json.to_string(),
            color_theme: theme,
            is_always_on_top: false,
            is_open: true,
            is_pinned: false,
            is_archived: false,
            window_x: win_x,
            window_y: win_y,
            window_width: win_w,
            window_height: win_h,
            z_order: 0,
            created_at: now,
            updated_at: now,
        })
    }

    pub fn update_note_content(
        &self,
        id: &str,
        title: Option<&str>,
        content_raw: &str,
        content_json: &str,
        x: Option<i32>,
        y: Option<i32>,
        width: Option<i32>,
        height: Option<i32>,
    ) -> Result<(), rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        let now = Utc::now().timestamp_millis();

        // Extract title from first line if not provided
        let derived_title = if let Some(t) = title {
            t.to_string()
        } else {
            let first_line = content_raw.lines().next().unwrap_or("").trim();
            if first_line.is_empty() {
                "Untitled Note".to_string()
            } else {
                let trimmed = first_line.chars().take(40).collect::<String>();
                trimmed.trim_start_matches('#').trim().to_string()
            }
        };

        if let (Some(wx), Some(wy), Some(ww), Some(wh)) = (x, y, width, height) {
            conn.execute(
                "UPDATE notes SET
                    title = ?1,
                    content_raw = ?2,
                    content_json = ?3,
                    window_x = ?4,
                    window_y = ?5,
                    window_width = ?6,
                    window_height = ?7,
                    updated_at = ?8
                 WHERE id = ?9",
                params![derived_title, content_raw, content_json, wx, wy, ww, wh, now, id],
            )?;
        } else {
            conn.execute(
                "UPDATE notes SET
                    title = ?1,
                    content_raw = ?2,
                    content_json = ?3,
                    updated_at = ?4
                 WHERE id = ?5",
                params![derived_title, content_raw, content_json, now, id],
            )?;
        }
        Ok(())
    }

    pub fn update_note_geometry(&self, id: &str, x: i32, y: i32, width: i32, height: i32) -> Result<(), rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        let now = Utc::now().timestamp_millis();
        conn.execute(
            "UPDATE notes SET window_x = ?1, window_y = ?2, window_width = ?3, window_height = ?4, updated_at = ?5 WHERE id = ?6",
            params![x, y, width, height, now, id],
        )?;
        Ok(())
    }

    pub fn set_note_theme(&self, id: &str, color_theme: &str) -> Result<(), rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        let now = Utc::now().timestamp_millis();
        conn.execute(
            "UPDATE notes SET color_theme = ?1, updated_at = ?2 WHERE id = ?3",
            params![color_theme, now, id],
        )?;
        Ok(())
    }

    pub fn set_note_always_on_top(&self, id: &str, always_on_top: bool) -> Result<(), rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        let now = Utc::now().timestamp_millis();
        conn.execute(
            "UPDATE notes SET is_always_on_top = ?1, updated_at = ?2 WHERE id = ?3",
            params![if always_on_top { 1 } else { 0 }, now, id],
        )?;
        Ok(())
    }

    pub fn set_note_open_status(&self, id: &str, is_open: bool) -> Result<(), rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        let now = Utc::now().timestamp_millis();
        conn.execute(
            "UPDATE notes SET is_open = ?1, updated_at = ?2 WHERE id = ?3",
            params![if is_open { 1 } else { 0 }, now, id],
        )?;
        Ok(())
    }

    pub fn set_note_pinned_status(&self, id: &str, is_pinned: bool) -> Result<(), rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        let now = Utc::now().timestamp_millis();
        conn.execute(
            "UPDATE notes SET is_pinned = ?1, updated_at = ?2 WHERE id = ?3",
            params![if is_pinned { 1 } else { 0 }, now, id],
        )?;
        Ok(())
    }

    pub fn delete_note_permanent(&self, id: &str) -> Result<(), rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM notes WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn set_note_archived(&self, id: &str, is_archived: bool) -> Result<(), rusqlite::Error> {
        let conn = self.conn.lock().unwrap();
        let now = Utc::now().timestamp_millis();
        conn.execute(
            "UPDATE notes SET is_archived = ?1, is_open = 0, updated_at = ?2 WHERE id = ?3",
            params![if is_archived { 1 } else { 0 }, now, id],
        )?;
        Ok(())
    }
}
