import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { VibeNotesDB } from '../src/db.js';
import { registerTools } from '../src/tools.js';
import { registerResources } from '../src/resources.js';
import { registerPrompts } from '../src/prompts.js';

describe('MCP Server End-to-End Tools Integration', () => {
  let db: VibeNotesDB;
  let testDbPath: string;
  let server: McpServer;
  let client: Client;

  before(async () => {
    testDbPath = path.join(os.tmpdir(), `vibenotes_mcp_test_${Date.now()}.db`);
    db = new VibeNotesDB(testDbPath);

    server = new McpServer({
      name: 'vibenotes-test-server',
      version: '0.1.0',
    });

    registerTools(server, db);
    registerResources(server, db);
    registerPrompts(server, db);

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);

    client = new Client({ name: 'test-client', version: '0.1.0' });
    await client.connect(clientTransport);
  });

  after(async () => {
    db.close();
    try {
      if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
      const wal = `${testDbPath}-wal`;
      const shm = `${testDbPath}-shm`;
      if (fs.existsSync(wal)) fs.unlinkSync(wal);
      if (fs.existsSync(shm)) fs.unlinkSync(shm);
    } catch {}
  });

  test('list_tools returns all 8 sticky note tools', async () => {
    const tools = await client.listTools();
    const toolNames = tools.tools.map((t) => t.name);

    assert.ok(toolNames.includes('create_note'));
    assert.ok(toolNames.includes('get_note'));
    assert.ok(toolNames.includes('list_notes'));
    assert.ok(toolNames.includes('update_note'));
    assert.ok(toolNames.includes('append_note_content'));
    assert.ok(toolNames.includes('manage_checklist'));
    assert.ok(toolNames.includes('delete_note'));
    assert.ok(toolNames.includes('restore_note'));
  });

  test('create_note tool creates a note with markdown code block and table', async () => {
    const md = `# Dev Notes

| Service | Port |
| :--- | :--- |
| API | 3000 |
| DB | 5432 |

\`\`\`rust
fn start() {
    println!("Server listening");
}
\`\`\`

- [ ] Run migration
- [x] Configure env`;

    const res = await client.callTool({
      name: 'create_note',
      arguments: {
        title: 'Dev Notes',
        content: md,
        color_theme: 'blue',
        is_pinned: true,
      },
    });

    assert.strictEqual(res.isError, undefined);
    const text = (res.content[0] as { type: 'text'; text: string }).text;
    assert.ok(text.includes('Dev Notes'));

    // Check in database
    const all = db.getAllNotes();
    assert.strictEqual(all.length, 1);
    assert.strictEqual(all[0].color_theme, 'blue');
    assert.strictEqual(all[0].is_pinned, true);
    assert.ok(all[0].content_json.includes('codeBlock'));
    assert.ok(all[0].content_json.includes('table'));
    assert.ok(all[0].content_json.includes('taskList'));
  });

  test('manage_checklist tool checks items and adds new items', async () => {
    const all = db.getAllNotes();
    const noteId = all[0].id;

    // 1. Mark task 0 as done
    const checkRes = await client.callTool({
      name: 'manage_checklist',
      arguments: {
        id: noteId,
        action: 'check',
        item_index: 0,
      },
    });
    assert.strictEqual(checkRes.isError, undefined);
    const checkText = (checkRes.content[0] as { type: 'text'; text: string }).text;
    assert.ok(checkText.includes('COMPLETED [x]'));

    // 2. Add new item
    const addRes = await client.callTool({
      name: 'manage_checklist',
      arguments: {
        id: noteId,
        action: 'add_item',
        new_item_text: 'Verify deployment logs',
      },
    });
    assert.strictEqual(addRes.isError, undefined);

    const note = db.getNoteById(noteId)!;
    assert.ok(note.content_raw.includes('- [ ] Verify deployment logs'));
  });

  test('update_note and append_note_content tools work as expected', async () => {
    const all = db.getAllNotes();
    const noteId = all[0].id;

    // Append section
    const appendRes = await client.callTool({
      name: 'append_note_content',
      arguments: {
        id: noteId,
        content: '### Deployment Notes\nAll green in production.',
      },
    });
    assert.strictEqual(appendRes.isError, undefined);

    const updated = db.getNoteById(noteId)!;
    assert.ok(updated.content_raw.includes('### Deployment Notes'));
    assert.ok(updated.content_json.includes('All green in production'));
  });

  test('delete_note and restore_note tools manage archive and deletion', async () => {
    const all = db.getAllNotes();
    const noteId = all[0].id;

    // Archive
    const delRes = await client.callTool({
      name: 'delete_note',
      arguments: {
        id: noteId,
        permanent: false,
      },
    });
    assert.strictEqual(delRes.isError, undefined);
    assert.strictEqual(db.getNoteById(noteId)?.is_archived, true);

    // Restore
    const restRes = await client.callTool({
      name: 'restore_note',
      arguments: {
        id: noteId,
      },
    });
    assert.strictEqual(restRes.isError, undefined);
    assert.strictEqual(db.getNoteById(noteId)?.is_archived, false);
  });
});
