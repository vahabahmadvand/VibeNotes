import { z } from 'zod';
import { VibeNotesDB } from './db.js';
import { extractChecklist } from './checklist.js';

export function registerPrompts(server: any, db: VibeNotesDB) {
  // 1. Summarize All Notes
  server.prompt(
    'summarize_notes',
    'Summarize all active sticky notes, categorizing by topics and themes.',
    {},
    async () => {
      const notes = db.getAllNotes({ includeArchived: false });
      const compiled = notes
        .map((n) => `### Note: ${n.title} (Theme: ${n.color_theme})\nID: ${n.id}\n${n.content_raw}`)
        .join('\n\n---\n\n');

      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Here are all active sticky notes from VibeNotes:\n\n${compiled}\n\nPlease provide a clear summary of all notes, highlighting key decisions, code snippets, reminders, and pending tasks.`,
            },
          },
        ],
      };
    }
  );

  // 2. Review Tasks & Checklists
  server.prompt(
    'review_tasks',
    'Review all pending and completed checklist items across all sticky notes.',
    {},
    async () => {
      const notes = db.getAllNotes({ includeArchived: false });
      const taskList: string[] = [];

      for (const n of notes) {
        const tasks = extractChecklist(n.content_raw);
        if (tasks.length > 0) {
          taskList.push(`### Note: ${n.title} (ID: ${n.id})`);
          for (const t of tasks) {
            taskList.push(`- [${t.checked ? 'x' : ' '}] (Index: ${t.index}) ${t.text}`);
          }
          taskList.push('');
        }
      }

      const tasksCompiled = taskList.join('\n');

      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: tasksCompiled
                ? `Here are all task checklists from VibeNotes:\n\n${tasksCompiled}\n\nPlease review these tasks, list the most urgent pending tasks, and suggest next steps.`
                : 'There are currently no checklist items in any active sticky notes.',
            },
          },
        ],
      };
    }
  );
}
