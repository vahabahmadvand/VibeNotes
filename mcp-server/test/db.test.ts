import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { VibeNotesDB } from '../src/db.js';

describe('VibeNotes SQLite Database Operations', () => {
  let db: VibeNotesDB;
  let testDbPath: string;

  before(() => {
    testDbPath = path.join(os.tmpdir(), `vibenotes_test_${Date.now()}.db`);
    db = new VibeNotesDB(testDbPath);
  });

  after(() => {
    db.close();
    try {
      if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
      const wal = `${testDbPath}-wal`;
      const shm = `${testDbPath}-shm`;
      if (fs.existsSync(wal)) fs.unlinkSync(wal);
      if (fs.existsSync(shm)) fs.unlinkSync(shm);
    } catch {}
  });

  test('creates a new note with default fields and title extraction', () => {
    const note = db.createNote({
      content_raw: '# My Heading\nSome body text',
      content_json: '{"type":"doc"}',
      color_theme: 'green',
    });

    assert.ok(note.id);
    assert.strictEqual(note.title, 'My Heading');
    assert.strictEqual(note.color_theme, 'green');
    assert.strictEqual(note.is_archived, false);
    assert.strictEqual(note.is_open, true);
  });

  test('retrieves notes and filters by search/theme', () => {
    db.createNote({
      title: 'Rust Tips',
      content_raw: 'Memory safety without garbage collection',
      content_json: '{"type":"doc"}',
      color_theme: 'charcoal',
    });

    const all = db.getAllNotes();
    assert.strictEqual(all.length, 2);

    const rustNotes = db.getAllNotes({ search: 'Rust' });
    assert.strictEqual(rustNotes.length, 1);
    assert.strictEqual(rustNotes[0].title, 'Rust Tips');

    const greenNotes = db.getAllNotes({ colorTheme: 'green' });
    assert.strictEqual(greenNotes.length, 1);
  });

  test('updates note content and theme', () => {
    const note = db.createNote({
      content_raw: 'Initial note',
      content_json: '{"type":"doc"}',
    });

    const updated = db.updateNote(note.id, {
      title: 'Updated Note Title',
      content_raw: 'Updated raw content',
      color_theme: 'purple',
      is_pinned: true,
    });

    assert.ok(updated);
    assert.strictEqual(updated?.title, 'Updated Note Title');
    assert.strictEqual(updated?.content_raw, 'Updated raw content');
    assert.strictEqual(updated?.color_theme, 'purple');
    assert.strictEqual(updated?.is_pinned, true);
  });

  test('archives, restores, and permanently deletes note', () => {
    const note = db.createNote({
      title: 'To be archived',
      content_raw: 'Temporary info',
      content_json: '{"type":"doc"}',
    });

    // 1. Archive
    const archivedSuccess = db.setNoteArchived(note.id, true);
    assert.strictEqual(archivedSuccess, true);

    const activeList = db.getAllNotes({ includeArchived: false });
    assert.ok(!activeList.some((n) => n.id === note.id));

    const archiveList = db.getAllNotes({ includeArchived: true });
    assert.ok(archiveList.some((n) => n.id === note.id));

    // 2. Restore
    const restoreSuccess = db.setNoteArchived(note.id, false);
    assert.strictEqual(restoreSuccess, true);
    const restored = db.getNoteById(note.id);
    assert.strictEqual(restored?.is_archived, false);

    // 3. Permanent delete
    const deleteSuccess = db.deleteNotePermanent(note.id);
    assert.strictEqual(deleteSuccess, true);
    const nonExistent = db.getNoteById(note.id);
    assert.strictEqual(nonExistent, null);
  });
});
