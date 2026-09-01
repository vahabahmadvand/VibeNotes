import { TipTapDoc, TipTapNode } from './types.js';

/**
 * Parses inline markdown marks (bold, italic, strike, underline, code, link).
 */
export function parseInlineFormatting(text: string): TipTapNode[] {
  if (!text) {
    return [];
  }

  // Tokenizer for inline marks
  interface Token {
    text: string;
    marks?: Array<{ type: string; attrs?: Record<string, any> }>;
  }

  // Regexes for inline marks:
  // Code: `code`
  // Link: [text](url)
  // Bold+Italic: ***text*** or ___text___
  // Bold: **text** or __text__
  // Italic: *text* or _text_
  // Strike: ~~text~~
  // Underline: <u>text</u>
  
  const tokens: Token[] = [{ text }];

  function applyPattern(
    regex: RegExp,
    markCreator: (match: RegExpExecArray) => { type: string; attrs?: Record<string, any> } | Array<{ type: string; attrs?: Record<string, any> }>,
    contentExtractor: (match: RegExpExecArray) => string
  ) {
    for (let i = 0; i < tokens.length; i++) {
      const current = tokens[i];
      // Skip if token already has code mark
      if (current.marks?.some((m) => m.type === 'code')) continue;

      const match = regex.exec(current.text);
      if (match && match.index !== undefined) {
        const fullMatch = match[0];
        const matchIndex = match.index;
        const beforeText = current.text.slice(0, matchIndex);
        const innerText = contentExtractor(match);
        const afterText = current.text.slice(matchIndex + fullMatch.length);

        const newMarksResult = markCreator(match);
        const newMarks = Array.isArray(newMarksResult) ? newMarksResult : [newMarksResult];
        const combinedMarks = [...(current.marks || []), ...newMarks];

        const replacement: Token[] = [];
        if (beforeText) {
          replacement.push({ text: beforeText, marks: current.marks });
        }
        if (innerText) {
          replacement.push({ text: innerText, marks: combinedMarks });
        }
        if (afterText) {
          replacement.push({ text: afterText, marks: current.marks });
        }

        tokens.splice(i, 1, ...replacement);
        i--; // Re-process this segment for multiple matches
      }
    }
  }

  // 1. Inline Code (highest precedence)
  applyPattern(
    /`([^`]+)`/,
    () => ({ type: 'code' }),
    (m) => m[1]
  );

  // 2. Links [text](url)
  applyPattern(
    /\[([^\]]+)\]\(([^)]+)\)/,
    (m) => ({ type: 'link', attrs: { href: m[2], target: '_blank' } }),
    (m) => m[1]
  );

  // 3. Bold + Italic ***text*** or ___text___
  applyPattern(
    /(\*\*\*|___)(.*?)\1/,
    () => [{ type: 'bold' }, { type: 'italic' }],
    (m) => m[2]
  );

  // 4. Bold **text** or __text__
  applyPattern(
    /(\*\*|__)(.*?)\1/,
    () => ({ type: 'bold' }),
    (m) => m[2]
  );

  // 5. Italic *text* or _text_
  applyPattern(
    /(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)|(?<!_)_(?!_)(.*?)(?<!_)_(?!_)/,
    () => ({ type: 'italic' }),
    (m) => m[1] ?? m[2]
  );

  // 6. Strikethrough ~~text~~
  applyPattern(
    /~~(.*?)~~/,
    () => ({ type: 'strike' }),
    (m) => m[1]
  );

  // 7. Underline <u>text</u>
  applyPattern(
    /<u>(.*?)<\/u>/i,
    () => ({ type: 'underline' }),
    (m) => m[1]
  );

  return tokens
    .filter((t) => t.text.length > 0)
    .map((t) => {
      const node: TipTapNode = { type: 'text', text: t.text };
      if (t.marks && t.marks.length > 0) {
        node.marks = t.marks;
      }
      return node;
    });
}

/**
 * Converts a Markdown string to TipTap/ProseMirror Document JSON.
 */
export function markdownToTipTap(markdown: string): TipTapDoc {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const nodes: TipTapNode[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Skip blank lines between blocks
    if (line.trim() === '') {
      i++;
      continue;
    }

    // 1. Code Block (Fenced)
    if (line.trim().startsWith('```')) {
      const langMatch = line.trim().match(/^```([a-zA-Z0-9_\-+]*)/);
      const language = langMatch && langMatch[1] ? langMatch[1].toLowerCase() : null;
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // Skip closing ```
      const codeText = codeLines.join('\n');
      const codeBlockNode: TipTapNode = {
        type: 'codeBlock',
        attrs: { language },
      };
      if (codeText.length > 0) {
        codeBlockNode.content = [{ type: 'text', text: codeText }];
      }
      nodes.push(codeBlockNode);
      continue;
    }

    // 2. Table Block
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const tableRows: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableRows.push(lines[i].trim());
        i++;
      }

      // Parse markdown table rows
      const parsedRows: string[][] = [];
      let isHeaderSeparatorPresent = false;

      for (let r = 0; r < tableRows.length; r++) {
        const rowStr = tableRows[r];
        // Check if this is separator row e.g. |---|:---|---:|
        if (/^\|(\s*:?-+:?\s*\|)+$/.test(rowStr)) {
          isHeaderSeparatorPresent = true;
          continue;
        }
        const cells = rowStr
          .slice(1, -1)
          .split('|')
          .map((c) => c.trim());
        parsedRows.push(cells);
      }

      if (parsedRows.length > 0) {
        const rowNodes: TipTapNode[] = [];

        parsedRows.forEach((cells, rowIdx) => {
          const isHeader = isHeaderSeparatorPresent && rowIdx === 0;
          const cellType = isHeader ? 'tableHeader' : 'tableCell';

          const cellNodes: TipTapNode[] = cells.map((cellText) => {
            const inlineNodes = parseInlineFormatting(cellText);
            const paragraph: TipTapNode = {
              type: 'paragraph',
              content: inlineNodes.length > 0 ? inlineNodes : undefined,
            };
            return {
              type: cellType,
              attrs: {
                colspan: 1,
                rowspan: 1,
                colwidth: null,
                align: null,
              },
              content: [paragraph],
            };
          });

          rowNodes.push({
            type: 'tableRow',
            content: cellNodes,
          });
        });

        nodes.push({
          type: 'table',
          content: rowNodes,
        });
      }
      continue;
    }

    // 3. Task List / Checklist item
    const taskMatch = line.match(/^(\s*)[-*+]\s+\[([ xX])\]\s*(.*)$/);
    if (taskMatch) {
      const taskItems: TipTapNode[] = [];

      while (i < lines.length) {
        const currentTaskMatch = lines[i].match(/^(\s*)[-*+]\s+\[([ xX])\]\s*(.*)$/);
        if (!currentTaskMatch) break;

        const isChecked = currentTaskMatch[2].toLowerCase() === 'x';
        const taskText = currentTaskMatch[3];
        const inlineNodes = parseInlineFormatting(taskText);

        taskItems.push({
          type: 'taskItem',
          attrs: { checked: isChecked },
          content: [
            {
              type: 'paragraph',
              content: inlineNodes.length > 0 ? inlineNodes : undefined,
            },
          ],
        });
        i++;
      }

      nodes.push({
        type: 'taskList',
        content: taskItems,
      });
      continue;
    }

    // 4. Bullet List
    const bulletMatch = line.match(/^(\s*)[-*+]\s+(?!\[[ xX]\])(.*)$/);
    if (bulletMatch) {
      const listItems: TipTapNode[] = [];

      while (i < lines.length) {
        const currentBulletMatch = lines[i].match(/^(\s*)[-*+]\s+(?!\[[ xX]\])(.*)$/);
        if (!currentBulletMatch) break;

        const itemText = currentBulletMatch[2];
        const inlineNodes = parseInlineFormatting(itemText);

        listItems.push({
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: inlineNodes.length > 0 ? inlineNodes : undefined,
            },
          ],
        });
        i++;
      }

      nodes.push({
        type: 'bulletList',
        content: listItems,
      });
      continue;
    }

    // 5. Ordered List
    const orderedMatch = line.match(/^(\s*)\d+\.\s+(.*)$/);
    if (orderedMatch) {
      const listItems: TipTapNode[] = [];

      while (i < lines.length) {
        const currentOrderedMatch = lines[i].match(/^(\s*)\d+\.\s+(.*)$/);
        if (!currentOrderedMatch) break;

        const itemText = currentOrderedMatch[2];
        const inlineNodes = parseInlineFormatting(itemText);

        listItems.push({
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: inlineNodes.length > 0 ? inlineNodes : undefined,
            },
          ],
        });
        i++;
      }

      nodes.push({
        type: 'orderedList',
        content: listItems,
      });
      continue;
    }

    // 6. Heading (# to ######)
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2];
      const inlineNodes = parseInlineFormatting(headingText);

      nodes.push({
        type: 'heading',
        attrs: { level },
        content: inlineNodes.length > 0 ? inlineNodes : undefined,
      });
      i++;
      continue;
    }

    // 7. Horizontal Rule (---, ***, ___)
    if (/^(\*{3,}|-{3,}|_{3,})$/.test(line.trim())) {
      nodes.push({ type: 'horizontalRule' });
      i++;
      continue;
    }

    // 8. Blockquote (> text)
    if (line.trim().startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      const quoteText = quoteLines.join('\n');
      const inlineNodes = parseInlineFormatting(quoteText);

      nodes.push({
        type: 'blockquote',
        content: [
          {
            type: 'paragraph',
            content: inlineNodes.length > 0 ? inlineNodes : undefined,
          },
        ],
      });
      continue;
    }

    // 9. Standard Paragraph (or empty line)
    const inlineNodes = parseInlineFormatting(line);
    nodes.push({
      type: 'paragraph',
      content: inlineNodes.length > 0 ? inlineNodes : undefined,
    });
    i++;
  }

  // Ensure at least one paragraph exists if empty
  if (nodes.length === 0) {
    nodes.push({ type: 'paragraph' });
  }

  return {
    type: 'doc',
    content: nodes,
  };
}

/**
 * Converts a TipTap Document JSON back to clean Markdown.
 */
export function tipTapToMarkdown(doc: TipTapDoc | TipTapNode): string {
  if (!doc) return '';

  function renderInline(node: TipTapNode): string {
    if (node.type === 'text') {
      let txt = node.text || '';
      if (!node.marks) return txt;

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

  function renderNode(node: TipTapNode): string {
    switch (node.type) {
      case 'doc':
        return (node.content || []).map(renderNode).join('\n\n');

      case 'paragraph': {
        const inner = (node.content || []).map(renderInline).join('');
        return inner;
      }

      case 'heading': {
        const level = node.attrs?.level || 1;
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
        const inner = (node.content || []).map(renderNode).join('\n');
        return inner
          .split('\n')
          .map((l) => `> ${l}`)
          .join('\n');
      }

      case 'bulletList': {
        return (node.content || [])
          .map((item) => {
            const itemText = (item.content || []).map(renderNode).join('\n');
            return `- ${itemText}`;
          })
          .join('\n');
      }

      case 'orderedList': {
        return (node.content || [])
          .map((item, idx) => {
            const itemText = (item.content || []).map(renderNode).join('\n');
            return `${idx + 1}. ${itemText}`;
          })
          .join('\n');
      }

      case 'taskList': {
        return (node.content || [])
          .map((item) => {
            const isChecked = Boolean(item.attrs?.checked);
            const box = isChecked ? '[x]' : '[ ]';
            const itemText = (item.content || []).map(renderNode).join(' ');
            return `- ${box} ${itemText}`;
          })
          .join('\n');
      }

      case 'horizontalRule':
        return '---';

      case 'table': {
        const rows = node.content || [];
        if (rows.length === 0) return '';

        const tableLines: string[] = [];
        let headerParsed = false;

        rows.forEach((rowNode, rIdx) => {
          const cells = rowNode.content || [];
          const cellTexts = cells.map((c) => (c.content || []).map(renderNode).join(' ').trim());
          tableLines.push(`| ${cellTexts.join(' | ')} |`);

          if (rIdx === 0 && cells.some((c) => c.type === 'tableHeader')) {
            const separator = cells.map(() => '---').join(' | ');
            tableLines.push(`| ${separator} |`);
            headerParsed = true;
          }
        });

        if (!headerParsed && tableLines.length > 0) {
          // If no explicit tableHeader, insert a separator after row 0
          const firstRowCells = (rows[0].content || []).length;
          const sep = new Array(firstRowCells).fill('---').join(' | ');
          tableLines.splice(1, 0, `| ${sep} |`);
        }

        return tableLines.join('\n');
      }

      default:
        if (node.content) {
          return node.content.map(renderNode).join('');
        }
        return '';
    }
  }

  return renderNode(doc as TipTapNode).trim();
}
