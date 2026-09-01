import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { v4 as uuidv4 } from 'uuid';
import { Note, NoteTheme } from './types.js';

/**
 * Resolves the path to the VibeNotes SQLite database file.
 */
export function getDatabasePath(): string {
  if (process.env.VIBENOTES_DB_PATH) {
    return path.resolve(process.env.VIBENOTES_DB_PATH);
  }

  const platform = os.platform();
  let baseDir: string;

  if (platform === 'win32') {
    baseDir = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  } else if (platform === 'darwin') {
    baseDir = path.join(os.homedir(), 'Library', 'Application Support');
  } else {
    baseDir = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
  }

  const vibeNotesDir = path.join(baseDir, 'VibeNotes');
  return path.join(vibeNotesDir, 'vibenotes.db');
}

export class VibeNotesDB {
  private db: DatabaseSync;
  public readonly dbPath: string;

  constructor(customPath?: string) {
    this.dbPath = customPath ? path.resolve(customPath) : getDatabasePath();
    const dir = path.dirname(this.dbPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new DatabaseSync(this.dbPath);

    // Initialize PRAGMAs for concurrency and crash-resilience
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA foreign_keys = ON;
      PRAGMA busy_timeout = 5000;
    `);

    // Ensure table definitions
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS notes (
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
      CREATE INDEX IF NOT EXISTS idx_notes_status ON notes(is_open, is_archived);
    `);
  }

  private mapRow(row: any): Note {
    return {
      id: String(row.id),
      title: String(row.title),
      content_raw: String(row.content_raw || ''),
      content_json: String(row.content_json || ''),
      color_theme: (row.color_theme || 'yellow') as NoteTheme,
      is_always_on_top: Boolean(row.is_always_on_top),
      is_open: Boolean(row.is_open),
      is_pinned: Boolean(row.is_pinned),
      is_archived: Boolean(row.is_archived),
      window_x: Number(row.window_x || 120),
      window_y: Number(row.window_y || 120),
      window_width: Number(row.window_width || 340),
      window_height: Number(row.window_height || 400),
      z_order: Number(row.z_order || 0),
      created_at: Number(row.created_at || Date.now()),
      updated_at: Number(row.updated_at || Date.now()),
    };
  }

  public getAllNotes(options?: {
    includeArchived?: boolean;
    colorTheme?: string;
    search?: string;
  }): Note[] {
    let sql = 'SELECT * FROM notes WHERE 1=1';
    const params: any[] = [];

    if (!options?.includeArchived) {
      sql += ' AND is_archived = 0';
    }

    if (options?.colorTheme && options.colorTheme !== 'all') {
      sql += ' AND color_theme = ?';
      params.push(options.colorTheme);
    }

    if (options?.search) {
      sql += ' AND (title LIKE ? OR content_raw LIKE ?)';
      const queryPattern = `%${options.search}%`;
      params.push(queryPattern, queryPattern);
    }

    sql += ' ORDER BY is_pinned DESC, updated_at DESC';

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params);
    return rows.map((r) => this.mapRow(r));
  }

  public getNoteById(id: string): Note | null {
    const stmt = this.db.prepare('SELECT * FROM notes WHERE id = ?');
    const row = stmt.get(id);
    return row ? this.mapRow(row) : null;
  }

  public createNote(params: {
    title?: string;
    content_raw: string;
    content_json: string;
    color_theme?: NoteTheme;
    is_always_on_top?: boolean;
    is_pinned?: boolean;
    window_x?: number;
    window_y?: number;
  }): Note {
    const id = uuidv4();
    const now = Date.now();
    const theme = params.color_theme || 'yellow';
    const raw = params.content_raw || '';
    const json = params.content_json || '{"type":"doc","content":[{"type":"paragraph"}]}';

    let derivedTitle = params.title?.trim();
    if (!derivedTitle) {
      const firstLine = raw.split('\n')[0]?.trim() || '';
      if (firstLine.length > 0) {
        derivedTitle = firstLine.replace(/^[#\s*\-+]+/, '').slice(0, 40).trim();
      }
      if (!derivedTitle) {
        derivedTitle = 'Untitled Note';
      }
    }

    const winX = params.window_x ?? 150;
    const winY = params.window_y ?? 150;
    const winW = 340;
    const winH = 400;

    const stmt = this.db.prepare(`
      INSERT INTO notes (
        id, title, content_raw, content_json, color_theme,
        is_always_on_top, is_open, is_pinned, is_archived,
        window_x, window_y, window_width, window_height,
        z_order, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, 0, ?, ?, ?, ?, 0, ?, ?)
    `);

    stmt.run(
      id,
      derivedTitle,
      raw,
      json,
      theme,
      params.is_always_on_top ? 1 : 0,
      params.is_pinned ? 1 : 0,
      winX,
      winY,
      winW,
      winH,
      now,
      now
    );

    return this.getNoteById(id)!;
  }

  public updateNote(
    id: string,
    params: {
      title?: string;
      content_raw?: string;
      content_json?: string;
      color_theme?: NoteTheme;
      is_always_on_top?: boolean;
      is_pinned?: boolean;
      is_open?: boolean;
      is_archived?: boolean;
    }
  ): Note | null {
    const existing = this.getNoteById(id);
    if (!existing) return null;

    const now = Date.now();
    const raw = params.content_raw !== undefined ? params.content_raw : existing.content_raw;
    const json = params.content_json !== undefined ? params.content_json : existing.content_json;

    let derivedTitle = params.title !== undefined ? params.title.trim() : existing.title;
    if (params.title === undefined && params.content_raw !== undefined) {
      // If content updated without explicit title, auto-derive if old title was default or matched first line
      const firstLine = raw.split('\n')[0]?.trim() || '';
      if (firstLine.length > 0) {
        derivedTitle = firstLine.replace(/^[#\s*\-+]+/, '').slice(0, 40).trim();
      }
    }
    if (!derivedTitle) derivedTitle = 'Untitled Note';

    const theme = params.color_theme || existing.color_theme;
    const alwaysOnTop =
      params.is_always_on_top !== undefined ? (params.is_always_on_top ? 1 : 0) : existing.is_always_on_top ? 1 : 0;
    const isPinned = params.is_pinned !== undefined ? (params.is_pinned ? 1 : 0) : existing.is_pinned ? 1 : 0;
    const isOpen = params.is_open !== undefined ? (params.is_open ? 1 : 0) : existing.is_open ? 1 : 0;
    const isArchived =
      params.is_archived !== undefined ? (params.is_archived ? 1 : 0) : existing.is_archived ? 1 : 0;

    const stmt = this.db.prepare(`
      UPDATE notes SET
        title = ?,
        content_raw = ?,
        content_json = ?,
        color_theme = ?,
        is_always_on_top = ?,
        is_pinned = ?,
        is_open = ?,
        is_archived = ?,
        updated_at = ?
      WHERE id = ?
    `);

    stmt.run(derivedTitle, raw, json, theme, alwaysOnTop, isPinned, isOpen, isArchived, now, id);
    return this.getNoteById(id);
  }

  public setNoteArchived(id: string, isArchived: boolean): boolean {
    const now = Date.now();
    const stmt = this.db.prepare(
      'UPDATE notes SET is_archived = ?, is_open = 0, updated_at = ? WHERE id = ?'
    );
    const result = stmt.run(isArchived ? 1 : 0, now, id);
    return result.changes > 0;
  }

  public deleteNotePermanent(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM notes WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  public close(): void {
    this.db.close();
  }
}
