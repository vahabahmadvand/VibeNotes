import { ChecklistItem } from './types.js';

const TASK_REGEX = /^(\s*)[-*+]\s+\[([ xX])\]\s*(.*)$/;

/**
 * Extracts all checklist items from a raw markdown string.
 */
export function extractChecklist(rawText: string): ChecklistItem[] {
  const lines = rawText.replace(/\r\n/g, '\n').split('\n');
  const items: ChecklistItem[] = [];
  let index = 0;

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];
    const match = line.match(TASK_REGEX);
    if (match) {
      items.push({
        index,
        text: match[3].trim(),
        checked: match[2].toLowerCase() === 'x',
        line_number: lineNum + 1,
      });
      index++;
    }
  }

  return items;
}

export interface ModifyChecklistOptions {
  index?: number;
  text?: string;
  checked?: boolean; // If undefined, will toggle
}

/**
 * Updates a checklist item in raw markdown content.
 */
export function updateChecklistItem(
  rawText: string,
  options: ModifyChecklistOptions
): { updatedText: string; modifiedItem: ChecklistItem | null } {
  const lines = rawText.replace(/\r\n/g, '\n').split('\n');
  let itemCounter = 0;
  let modifiedItem: ChecklistItem | null = null;

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(TASK_REGEX);
    if (match) {
      const currentText = match[3].trim();
      const currentChecked = match[2].toLowerCase() === 'x';
      const currentIndex = itemCounter;
      itemCounter++;

      const isTarget =
        options.index !== undefined
          ? options.index === currentIndex
          : options.text !== undefined
          ? currentText.toLowerCase().includes(options.text.toLowerCase())
          : false;

      if (isTarget) {
        const nextChecked =
          options.checked !== undefined ? options.checked : !currentChecked;
        const box = nextChecked ? '[x]' : '[ ]';
        const indent = match[1] || '';
        lines[i] = `${indent}- ${box} ${currentText}`;

        modifiedItem = {
          index: currentIndex,
          text: currentText,
          checked: nextChecked,
          line_number: i + 1,
        };
        break;
      }
    }
  }

  return {
    updatedText: lines.join('\n'),
    modifiedItem,
  };
}

/**
 * Appends a new checklist item to markdown content.
 */
export function addChecklistItem(
  rawText: string,
  taskText: string,
  checked = false
): { updatedText: string; newItem: ChecklistItem } {
  const trimmed = rawText.trimEnd();
  const box = checked ? '[x]' : '[ ]';
  const newItemLine = `- ${box} ${taskText.trim()}`;

  const updatedText = trimmed.length > 0 ? `${trimmed}\n${newItemLine}` : newItemLine;
  const items = extractChecklist(updatedText);
  const newItem = items[items.length - 1];

  return {
    updatedText,
    newItem,
  };
}
