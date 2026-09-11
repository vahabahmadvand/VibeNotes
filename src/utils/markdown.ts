import type { Note } from '../types';

export interface TipTapNode {
  type: string;
  attrs?: Record<string, any>;
  content?: TipTapNode[];
  marks?: Array<{ type: string; attrs?: Record<string, any> }>;
  text?: string;
}

/**
 * Sanitizes a title string so that it can be safely used as a Windows filename.
 * Removes forbidden characters: < > : " / \ | ? * and control chars.
 */
export function sanitizeFileName(name: string): string {
  // eslint-disable-next-line no-control-regex
  const sanitized = (name || '')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/-+/g, '-')
    .replace(/^[-_\s]+|[-_\s]+$/g, '')
    .trim()
    .replace(/\.+$/, '');

  return sanitized || 'Untitled Note';
}

/**
 * Converts inline TipTap nodes (text, marks, hardBreaks) into Markdown inline text.
 */
export function renderInline(node: TipTapNode): string {
  if (node.type === 'hardBreak') {
    return '\n';
  }

  if (node.type === 'text') {
    let txt = node.text || '';
    if (!node.marks || node.marks.length === 0) return txt;

    // Apply marks in consistent order
    for (const mark of node.marks) {
      if (mark.type === 'bold') txt = `**${txt}**`;
      else if (mark.type === 'italic') txt = `*${txt}*`;
      else if (mark.type === 'underline') txt = `<u>${txt}</u>`;
      else if (mark.type === 'strike') txt = `~~${txt}~~`;
      else if (mark.type === 'code') txt = `\`${txt}\``;
      else if (mark.type === 'link' && mark.attrs?.href) txt = `[${txt}](${mark.attrs.href})`;
    }
    return txt;
  }

  return '';
}

/**
 * Converts a TipTap document node tree into formatted Markdown.
 */
export function tipTapToMarkdown(doc: TipTapNode | null | undefined, depth = 0): string {
  if (!doc) return '';

  function renderNode(node: TipTapNode, nodeDepth = 0): string {
    const nodeIndent = '  '.repeat(nodeDepth);

    switch (node.type) {
      case 'doc':
        return (node.content || []).map((child) => renderNode(child, 0)).join('\n\n');

      case 'text':
        return renderInline(node);

      case 'paragraph': {
        const inner = (node.content || []).map(renderInline).join('');
        return inner;
      }

      case 'heading': {
        const level = Math.min(Math.max(node.attrs?.level || 1, 1), 6);
        const prefix = '#'.repeat(level);
        const inner = (node.content || []).map(renderInline).join('');
        return `${prefix} ${inner}`;
      }

      case 'codeBlock': {
        const lang = node.attrs?.language || '';
        const codeText = (node.content || []).map((c) => c.text || '').join('');
        return `\`\`\`${lang}\n${codeText}\n\`\`\``;
      }

      case 'blockquote': {
        const inner = (node.content || []).map((child) => renderNode(child, 0)).join('\n');
        return inner
          .split('\n')
          .map((line) => `> ${line}`)
          .join('\n');
      }

      case 'bulletList': {
        return (node.content || [])
          .map((item) => {
            const lines: string[] = [];
            (item.content || []).forEach((child, index) => {
              if (child.type === 'bulletList' || child.type === 'orderedList' || child.type === 'taskList') {
                lines.push(renderNode(child, nodeDepth + 1));
              } else {
                const text = renderNode(child, nodeDepth);
                if (index === 0) {
                  lines.push(`${nodeIndent}- ${text}`);
                } else {
                  lines.push(`${nodeIndent}  ${text}`);
                }
              }
            });
            return lines.join('\n');
          })
          .join('\n');
      }

      case 'orderedList': {
        return (node.content || [])
          .map((item, idx) => {
            const lines: string[] = [];
            (item.content || []).forEach((child, index) => {
              if (child.type === 'bulletList' || child.type === 'orderedList' || child.type === 'taskList') {
                lines.push(renderNode(child, nodeDepth + 1));
              } else {
                const text = renderNode(child, nodeDepth);
                if (index === 0) {
                  lines.push(`${nodeIndent}${idx + 1}. ${text}`);
                } else {
                  lines.push(`${nodeIndent}   ${text}`);
                }
              }
            });
            return lines.join('\n');
          })
          .join('\n');
      }

      case 'taskList': {
        return (node.content || [])
          .map((item) => renderNode(item, nodeDepth))
          .join('\n');
      }

      case 'taskItem': {
        const isChecked = Boolean(node.attrs?.checked);
        const box = isChecked ? '[x]' : '[ ]';
        const lines: string[] = [];
        const content = node.content || [];
        if (content.length === 0) {
          return `${nodeIndent}- ${box}`;
        }
        content.forEach((child, index) => {
          if (child.type === 'taskList' || child.type === 'bulletList' || child.type === 'orderedList') {
            lines.push(renderNode(child, nodeDepth + 1));
          } else {
            const text = renderNode(child, nodeDepth);
            if (index === 0) {
              lines.push(`${nodeIndent}- ${box} ${text}`);
            } else {
              lines.push(`${nodeIndent}  ${text}`);
            }
          }
        });
        return lines.join('\n');
      }

      case 'horizontalRule':
        return '---';

      case 'image': {
        const alt = node.attrs?.alt || '';
        const src = node.attrs?.src || '';
        const title = node.attrs?.title ? ` "${node.attrs.title}"` : '';
        return `![${alt}](${src}${title})`;
      }

      case 'tableHeader':
      case 'tableCell': {
        return (node.content || []).map((c) => renderNode(c, 0)).join(' ').trim();
      }

      case 'tableRow': {
        return (node.content || []).map((c) => renderNode(c, 0)).join(' | ');
      }

      case 'table': {
        const rows = node.content || [];
        if (rows.length === 0) return '';

        const tableLines: string[] = [];
        let headerParsed = false;

        rows.forEach((rowNode, rIdx) => {
          const cells = rowNode.content || [];
          const cellTexts = cells.map((c) => renderNode(c, 0).replace(/\|/g, '\\|').trim());
          tableLines.push(`| ${cellTexts.join(' | ')} |`);

          if (rIdx === 0 && cells.some((c) => c.type === 'tableHeader')) {
            const separator = cells.map(() => '---').join(' | ');
            tableLines.push(`| ${separator} |`);
            headerParsed = true;
          }
        });

        if (!headerParsed && tableLines.length > 0) {
          const firstRowCells = (rows[0].content || []).length;
          const sep = new Array(firstRowCells).fill('---').join(' | ');
          tableLines.splice(1, 0, `| ${sep} |`);
        }

        return tableLines.join('\n');
      }

      default:
        if (node.content) {
          return node.content.map((c) => renderNode(c, nodeDepth)).join('');
        }
        return '';
    }
  }

  return renderNode(doc, depth).trim();
}

/**
 * Converts a Note object into full Markdown content.
 * Automatically prepends `# Title` if the title is set (and not "Untitled Note")
 * and the note does not already begin with that heading.
 */
export function noteToMarkdown(note: Note): string {
  let md = '';

  if (note.content_json) {
    try {
      const doc = typeof note.content_json === 'string'
        ? JSON.parse(note.content_json)
        : note.content_json;
      md = tipTapToMarkdown(doc);
    } catch {
      md = note.content_raw || '';
    }
  } else {
    md = note.content_raw || '';
  }

  // Prepend title heading if meaningful and not already at the beginning of the content
  const cleanTitle = (note.title || '').trim();
  if (cleanTitle && cleanTitle !== 'Untitled Note') {
    const trimmedMd = md.trim();
    const startsWithHeading = /^#\s+/m.test(trimmedMd);
    const startsWithSameTitle = trimmedMd.startsWith(`# ${cleanTitle}`);

    if (!startsWithSameTitle && !startsWithHeading) {
      md = `# ${cleanTitle}\n\n${trimmedMd}`.trim();
    }
  }

  return md;
}
