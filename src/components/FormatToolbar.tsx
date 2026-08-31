import React from 'react';
import { Editor } from '@tiptap/react';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  CheckSquare,
  Code,
  Table as TableIcon,
  Quote,
} from 'lucide-react';

interface FormatToolbarProps {
  editor: Editor | null;
}

export const FormatToolbar: React.FC<FormatToolbarProps> = ({ editor }) => {
  if (!editor) return null;

  const getBtnStyle = (isActive: boolean) => ({
    color: 'var(--note-toolbar-icon)',
    backgroundColor: isActive ? 'var(--note-toolbar-active)' : 'transparent',
  });

  const btnClass =
    'w-6 h-6 flex items-center justify-center rounded transition-colors hover:bg-[var(--note-toolbar-hover)] cursor-pointer';

  return (
    <div
      className="h-7 px-2 border-t border-black/10 dark:border-white/15 flex items-center gap-0.5 select-none bg-transparent"
      style={{ borderColor: 'var(--note-border)' }}
    >
      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={btnClass}
        style={getBtnStyle(editor.isActive('bold'))}
        title="Bold (Ctrl+B)"
      >
        <Bold size={13} strokeWidth={2.5} />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={btnClass}
        style={getBtnStyle(editor.isActive('italic'))}
        title="Italic (Ctrl+I)"
      >
        <Italic size={13} strokeWidth={2.5} />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        className={btnClass}
        style={getBtnStyle(editor.isActive('underline'))}
        title="Underline (Ctrl+U)"
      >
        <UnderlineIcon size={13} strokeWidth={2.5} />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleStrike().run()}
        className={btnClass}
        style={getBtnStyle(editor.isActive('strike'))}
        title="Strikethrough"
      >
        <Strikethrough size={13} strokeWidth={2.5} />
      </button>

      <div
        className="w-[1px] h-3.5 mx-0.5 opacity-30"
        style={{ backgroundColor: 'var(--note-toolbar-icon)' }}
      />

      <button
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        className={btnClass}
        style={getBtnStyle(editor.isActive('taskList'))}
        title="Checklist"
      >
        <CheckSquare size={13} strokeWidth={2.3} />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={btnClass}
        style={getBtnStyle(editor.isActive('bulletList'))}
        title="Bullet List"
      >
        <List size={13} strokeWidth={2.3} />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={btnClass}
        style={getBtnStyle(editor.isActive('orderedList'))}
        title="Numbered List"
      >
        <ListOrdered size={13} strokeWidth={2.3} />
      </button>

      <div
        className="w-[1px] h-3.5 mx-0.5 opacity-30"
        style={{ backgroundColor: 'var(--note-toolbar-icon)' }}
      />

      <button
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        className={btnClass}
        style={getBtnStyle(editor.isActive('codeBlock'))}
        title="Code Block"
      >
        <Code size={13} strokeWidth={2.3} />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={btnClass}
        style={getBtnStyle(editor.isActive('blockquote'))}
        title="Quote"
      >
        <Quote size={13} strokeWidth={2.3} />
      </button>
      <button
        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        className={btnClass}
        style={getBtnStyle(editor.isActive('table'))}
        title="Insert Table"
      >
        <TableIcon size={13} strokeWidth={2.3} />
      </button>
    </div>
  );
};
