import { z } from 'zod';
import { VibeNotesDB } from './db.js';
import { markdownToTipTap, tipTapToMarkdown } from './markdown-tiptap.js';
import { extractChecklist, updateChecklistItem, addChecklistItem } from './checklist.js';
import { NoteTheme } from './types.js';

export const ColorThemeEnum = z.enum([
  'yellow',
  'green',
  'pink',
  'purple',
  'blue',
  'charcoal',
  'grey',
]);

export function registerTools(server: any, db: VibeNotesDB) {
  // 1. List Notes
  server.tool(
    'list_notes',
    'List sticky notes with filtering options (search, color theme, archive status). Returns note titles, IDs, color themes, pin statuses, and task summaries.',
    {
      include_archived: z.boolean().optional().describe('Whether to include archived notes (default: false)'),
      color_theme: z.string().optional().describe("Filter by color ('yellow', 'green', 'pink', 'purple', 'blue', 'charcoal', 'grey', or 'all')"),
      search: z.string().optional().describe('Search query matching note title or body content'),
    },
    async ({ include_archived = false, color_theme, search }: any) => {
      const notes = db.getAllNotes({
        includeArchived: include_archived,
        colorTheme: color_theme,
        search,
      });

      const summaries = notes.map((n) => {
        const tasks = extractChecklist(n.content_raw);
        const completed = tasks.filter((t) => t.checked).length;
        const total = tasks.length;
        const preview = n.content_raw.slice(0, 120).replace(/\n+/g, ' ');

        return {
          id: n.id,
          title: n.title,
          color_theme: n.color_theme,
          is_pinned: n.is_pinned,
          is_open: n.is_open,
          is_archived: n.is_archived,
          preview: preview.length > 0 ? preview : '(Empty note)',
          tasks: total > 0 ? { total, completed, pending: total - completed } : null,
          updated_at: new Date(n.updated_at).toISOString(),
        };
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(summaries, null, 2),
          },
        ],
      };
    }
  );

  // 2. Get Note
  server.tool(
    'get_note',
    'Retrieve complete details and full Markdown content of a specific sticky note by its ID.',
    {
      id: z.string().describe('The unique UUID of the sticky note'),
    },
    async ({ id }: any) => {
      const note = db.getNoteById(id);
      if (!note) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Note with ID '${id}' not found.` }],
        };
      }

      const tasks = extractChecklist(note.content_raw);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                id: note.id,
                title: note.title,
                color_theme: note.color_theme,
                is_pinned: note.is_pinned,
                is_always_on_top: note.is_always_on_top,
                is_open: note.is_open,
                is_archived: note.is_archived,
                content: note.content_raw,
                checklist: tasks.length > 0 ? tasks : undefined,
                created_at: new Date(note.created_at).toISOString(),
                updated_at: new Date(note.updated_at).toISOString(),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // 3. Create Note
  server.tool(
    'create_note',
    'Create a new sticky note with rich markdown formatting (headings, syntax-highlighted code blocks, tables, checklists `- [ ]`/`- [x]`, formatting, quotes). Automatically renders in the VibeNotes desktop app.',
    {
      content: z.string().describe('Markdown content of the note (supports tables, code blocks, checklists, formatting)'),
      title: z.string().optional().describe('Optional custom note title (if omitted, derived from the first line)'),
      color_theme: ColorThemeEnum.optional().describe("Note background theme color ('yellow', 'green', 'pink', 'purple', 'blue', 'charcoal', 'grey')"),
      is_pinned: z.boolean().optional().describe('Pin the note to the top in the notes list/hub (default: false)'),
      is_always_on_top: z.boolean().optional().describe('Keep the sticky note window floating above all other windows (default: false)'),
    },
    async ({ content, title, color_theme = 'yellow', is_pinned = false, is_always_on_top = false }: any) => {
      const tiptapDoc = markdownToTipTap(content);
      const jsonStr = JSON.stringify(tiptapDoc);

      const note = db.createNote({
        title,
        content_raw: content,
        content_json: jsonStr,
        color_theme: color_theme as NoteTheme,
        is_pinned,
        is_always_on_top,
      });

      return {
        content: [
          {
            type: 'text',
            text: `Sticky note created successfully!\n\nID: ${note.id}\nTitle: ${note.title}\nTheme: ${note.color_theme}\n\nContent:\n${note.content_raw}`,
          },
        ],
      };
    }
  );

  // 4. Update Note
  server.tool(
    'update_note',
    'Update an existing sticky note content (with markdown tables, code blocks, checklists, etc.), title, color theme, pin, or always-on-top status.',
    {
      id: z.string().describe('The ID of the sticky note to update'),
      content: z.string().optional().describe('New Markdown content for the note'),
      title: z.string().optional().describe('New title for the note'),
      color_theme: ColorThemeEnum.optional().describe('New color theme'),
      is_pinned: z.boolean().optional().describe('Pin or unpin note'),
      is_always_on_top: z.boolean().optional().describe('Set always-on-top window status'),
    },
    async ({ id, content, title, color_theme, is_pinned, is_always_on_top }: any) => {
      const existing = db.getNoteById(id);
      if (!existing) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Note with ID '${id}' not found.` }],
        };
      }

      let content_json: string | undefined;
      if (content !== undefined) {
        const tiptapDoc = markdownToTipTap(content);
        content_json = JSON.stringify(tiptapDoc);
      }

      const updated = db.updateNote(id, {
        title,
        content_raw: content,
        content_json,
        color_theme: color_theme as NoteTheme | undefined,
        is_pinned,
        is_always_on_top,
      });

      return {
        content: [
          {
            type: 'text',
            text: `Sticky note '${id}' updated successfully!\n\nTitle: ${updated?.title}\nTheme: ${updated?.color_theme}\n\nContent:\n${updated?.content_raw}`,
          },
        ],
      };
    }
  );

  // 5. Append Note Content
  server.tool(
    'append_note_content',
    'Append markdown text, sections, code blocks, tables, or checklist items to an existing sticky note.',
    {
      id: z.string().describe('The ID of the sticky note'),
      content: z.string().describe('Markdown content to append'),
    },
    async ({ id, content }: any) => {
      const existing = db.getNoteById(id);
      if (!existing) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Note with ID '${id}' not found.` }],
        };
      }

      const newRaw = existing.content_raw.trimEnd() + '\n\n' + content.trimStart();
      const tiptapDoc = markdownToTipTap(newRaw);
      const jsonStr = JSON.stringify(tiptapDoc);

      const updated = db.updateNote(id, {
        content_raw: newRaw,
        content_json: jsonStr,
      });

      return {
        content: [
          {
            type: 'text',
            text: `Content appended to note '${id}'.\n\nUpdated Content:\n${updated?.content_raw}`,
          },
        ],
      };
    }
  );

  // 6. Manage Checklist
  server.tool(
    'manage_checklist',
    'Manage checklist / task items within a sticky note (list tasks, check as done, uncheck as pending, toggle state, or add new checklist items).',
    {
      id: z.string().describe('The ID of the sticky note'),
      action: z.enum(['list', 'check', 'uncheck', 'toggle', 'add_item']).describe("Action to perform ('list', 'check', 'uncheck', 'toggle', or 'add_item')"),
      item_index: z.number().int().optional().describe('0-based index of the checklist item to modify'),
      item_text: z.string().optional().describe('Search substring matching the checklist item to modify'),
      new_item_text: z.string().optional().describe('Text of the new checklist item (required when action is add_item)'),
    },
    async ({ id, action, item_index, item_text, new_item_text }: any) => {
      const existing = db.getNoteById(id);
      if (!existing) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Note with ID '${id}' not found.` }],
        };
      }

      if (action === 'list') {
        const tasks = extractChecklist(existing.content_raw);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  note_id: id,
                  total: tasks.length,
                  completed: tasks.filter((t) => t.checked).length,
                  tasks,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      if (action === 'add_item') {
        if (!new_item_text) {
          return {
            isError: true,
            content: [{ type: 'text', text: "Parameter 'new_item_text' is required when action is 'add_item'." }],
          };
        }

        const { updatedText, newItem } = addChecklistItem(existing.content_raw, new_item_text, false);
        const tiptapDoc = markdownToTipTap(updatedText);
        const jsonStr = JSON.stringify(tiptapDoc);

        db.updateNote(id, {
          content_raw: updatedText,
          content_json: jsonStr,
        });

        return {
          content: [
            {
              type: 'text',
              text: `Added checklist item: "${newItem.text}" (index: ${newItem.index})\n\nUpdated Note Content:\n${updatedText}`,
            },
          ],
        };
      }

      // Check, Uncheck, or Toggle
      let desiredChecked: boolean | undefined;
      if (action === 'check') desiredChecked = true;
      if (action === 'uncheck') desiredChecked = false;
      if (action === 'toggle') desiredChecked = undefined;

      const { updatedText, modifiedItem } = updateChecklistItem(existing.content_raw, {
        index: item_index,
        text: item_text,
        checked: desiredChecked,
      });

      if (!modifiedItem) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `No matching checklist item found for index=${item_index ?? 'none'}, text='${item_text ?? 'none'}'.`,
            },
          ],
        };
      }

      const tiptapDoc = markdownToTipTap(updatedText);
      const jsonStr = JSON.stringify(tiptapDoc);

      db.updateNote(id, {
        content_raw: updatedText,
        content_json: jsonStr,
      });

      return {
        content: [
          {
            type: 'text',
            text: `Checklist item updated!\nTask: "${modifiedItem.text}"\nStatus: ${modifiedItem.checked ? 'COMPLETED [x]' : 'PENDING [ ]'}\n\nUpdated Note Content:\n${updatedText}`,
          },
        ],
      };
    }
  );

  // 7. Delete Note
  server.tool(
    'delete_note',
    'Remove a sticky note. By default archives the note (safe soft delete). Set permanent=true to completely delete from database.',
    {
      id: z.string().describe('The ID of the sticky note to remove'),
      permanent: z.boolean().optional().describe('If true, permanently destroys note. If false, moves to archive (default: false)'),
    },
    async ({ id, permanent = false }: any) => {
      const existing = db.getNoteById(id);
      if (!existing) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Note with ID '${id}' not found.` }],
        };
      }

      if (permanent) {
        db.deleteNotePermanent(id);
        return {
          content: [
            {
              type: 'text',
              text: `Note '${id}' ("${existing.title}") permanently deleted from database.`,
            },
          ],
        };
      } else {
        db.setNoteArchived(id, true);
        return {
          content: [
            {
              type: 'text',
              text: `Note '${id}' ("${existing.title}") moved to archive. You can restore it anytime with 'restore_note'.`,
            },
          ],
        };
      }
    }
  );

  // 8. Restore Note
  server.tool(
    'restore_note',
    'Restore an archived sticky note back to active status.',
    {
      id: z.string().describe('The ID of the archived sticky note to restore'),
    },
    async ({ id }: any) => {
      const existing = db.getNoteById(id);
      if (!existing) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Note with ID '${id}' not found.` }],
        };
      }

      db.setNoteArchived(id, false);

      return {
        content: [
          {
            type: 'text',
            text: `Note '${id}' ("${existing.title}") successfully restored to active notes!`,
          },
        ],
      };
    }
  );
}
