import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { VibeNotesDB } from './db.js';

export function registerResources(server: any, db: VibeNotesDB) {
  // Static / Dynamic List Resource: vibenotes://notes
  server.resource(
    'all_notes',
    'vibenotes://notes',
    {
      description: 'List of all active VibeNotes sticky notes',
      mimeType: 'text/markdown',
    },
    async (uri: any) => {
      const notes = db.getAllNotes({ includeArchived: false });
      const markdown = notes
        .map(
          (n) =>
            `# ${n.title} (Theme: ${n.color_theme}${n.is_pinned ? ', Pinned' : ''})\n**ID:** \`${n.id}\`\n\n${n.content_raw}\n\n---`
        )
        .join('\n\n');

      return {
        contents: [
          {
            uri: uri.href,
            text: markdown || 'No active sticky notes found.',
            mimeType: 'text/markdown',
          },
        ],
      };
    }
  );

  // Parameterized Resource: vibenotes://notes/{id}
  server.resource(
    'note_by_id',
    new ResourceTemplate('vibenotes://notes/{id}', { list: undefined }),
    {
      description: 'Markdown content of a specific sticky note',
      mimeType: 'text/markdown',
    },
    async (uri: any, { id }: any) => {
      const note = db.getNoteById(id);
      if (!note) {
        throw new Error(`Sticky note with ID '${id}' not found.`);
      }

      const header = `# ${note.title}\n- **ID:** \`${note.id}\`\n- **Theme:** ${note.color_theme}\n- **Pinned:** ${note.is_pinned}\n- **Updated:** ${new Date(note.updated_at).toISOString()}\n\n`;

      return {
        contents: [
          {
            uri: uri.href,
            text: header + note.content_raw,
            mimeType: 'text/markdown',
          },
        ],
      };
    }
  );
}
