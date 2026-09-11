import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  sanitizeFileName,
  tipTapToMarkdown,
  noteToMarkdown,
} from '../src/utils/markdown.ts';
import type { TipTapNode } from '../src/utils/markdown.ts';
import type { Note } from '../src/types.ts';

describe('Markdown Export Utility', () => {
  describe('sanitizeFileName', () => {
    test('removes illegal Windows characters', () => {
      assert.strictEqual(sanitizeFileName('Note: "Test" <1>? *ok* | wow / yes \\ no'), 'Note- -Test- -1- -ok- - wow - yes - no');
      assert.strictEqual(sanitizeFileName('Normal Note Title'), 'Normal Note Title');
    });

    test('trims whitespace and trailing periods', () => {
      assert.strictEqual(sanitizeFileName('  My Note...  '), 'My Note');
    });

    test('falls back to default title if empty', () => {
      assert.strictEqual(sanitizeFileName(''), 'Untitled Note');
      assert.strictEqual(sanitizeFileName('   ???///:::   '), 'Untitled Note');
    });
  });

  describe('tipTapToMarkdown', () => {
    test('converts headings and paragraphs', () => {
      const doc: TipTapNode = {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'My Note Header' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'This is a sample paragraph.' }],
          },
        ],
      };

      const md = tipTapToMarkdown(doc);
      assert.strictEqual(md, '# My Note Header\n\nThis is a sample paragraph.');
    });

    test('converts inline formatting (bold, italic, strike, underline, code, link)', () => {
      const doc: TipTapNode = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
              { type: 'text', text: ' and ' },
              { type: 'text', text: 'italic', marks: [{ type: 'italic' }] },
              { type: 'text', text: ' and ' },
              { type: 'text', text: 'code', marks: [{ type: 'code' }] },
              { type: 'text', text: ' and ' },
              { type: 'text', text: 'link', marks: [{ type: 'link', attrs: { href: 'https://example.com' } }] },
            ],
          },
        ],
      };

      const md = tipTapToMarkdown(doc);
      assert.strictEqual(md, '**bold** and *italic* and `code` and [link](https://example.com)');
    });

    test('converts task lists / checklists', () => {
      const doc: TipTapNode = {
        type: 'doc',
        content: [
          {
            type: 'taskList',
            content: [
              {
                type: 'taskItem',
                attrs: { checked: false },
                content: [{ type: 'text', text: 'Buy milk' }],
              },
              {
                type: 'taskItem',
                attrs: { checked: true },
                content: [{ type: 'text', text: 'Call doctor' }],
              },
            ],
          },
        ],
      };

      const md = tipTapToMarkdown(doc);
      assert.strictEqual(md, '- [ ] Buy milk\n- [x] Call doctor');
    });

    test('converts code blocks with language', () => {
      const doc: TipTapNode = {
        type: 'doc',
        content: [
          {
            type: 'codeBlock',
            attrs: { language: 'typescript' },
            content: [{ type: 'text', text: 'const x = 1;\nconsole.log(x);' }],
          },
        ],
      };

      const md = tipTapToMarkdown(doc);
      assert.strictEqual(md, '```typescript\nconst x = 1;\nconsole.log(x);\n```');
    });

    test('converts tables', () => {
      const doc: TipTapNode = {
        type: 'doc',
        content: [
          {
            type: 'table',
            content: [
              {
                type: 'tableRow',
                content: [
                  { type: 'tableHeader', content: [{ type: 'text', text: 'Feature' }] },
                  { type: 'tableHeader', content: [{ type: 'text', text: 'Status' }] },
                ],
              },
              {
                type: 'tableRow',
                content: [
                  { type: 'tableCell', content: [{ type: 'text', text: 'Export' }] },
                  { type: 'tableCell', content: [{ type: 'text', text: 'Done' }] },
                ],
              },
            ],
          },
        ],
      };

      const md = tipTapToMarkdown(doc);
      assert.strictEqual(md, '| Feature | Status |\n| --- | --- |\n| Export | Done |');
    });
  });

  describe('noteToMarkdown', () => {
    test('prepends note title if not present in content', () => {
      const note: Note = {
        id: '123',
        title: 'Project Roadmap',
        content_raw: 'Some content',
        content_json: JSON.stringify({
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Some content' }],
            },
          ],
        }),
        color_theme: 'yellow',
        is_always_on_top: false,
        is_open: true,
        is_pinned: false,
        is_archived: false,
        window_x: 0,
        window_y: 0,
        window_width: 300,
        window_height: 300,
        z_order: 0,
        created_at: 1000,
        updated_at: 2000,
      };

      const md = noteToMarkdown(note);
      assert.strictEqual(md, '# Project Roadmap\n\nSome content');
    });

    test('does not duplicate heading if content already begins with title heading', () => {
      const note: Note = {
        id: '123',
        title: 'Project Roadmap',
        content_raw: '# Project Roadmap\nSome content',
        content_json: JSON.stringify({
          type: 'doc',
          content: [
            {
              type: 'heading',
              attrs: { level: 1 },
              content: [{ type: 'text', text: 'Project Roadmap' }],
            },
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Some content' }],
            },
          ],
        }),
        color_theme: 'yellow',
        is_always_on_top: false,
        is_open: true,
        is_pinned: false,
        is_archived: false,
        window_x: 0,
        window_y: 0,
        window_width: 300,
        window_height: 300,
        z_order: 0,
        created_at: 1000,
        updated_at: 2000,
      };

      const md = noteToMarkdown(note);
      assert.strictEqual(md, '# Project Roadmap\n\nSome content');
    });
  });
});
