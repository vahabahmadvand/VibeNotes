import React, { useState, useEffect } from 'react';
import { Editor } from '@tiptap/react';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
  AlignLeft,
  AlignRight,
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
  const [, setTick] = useState(0);

  // Subscribe to selection & transaction updates for real-time button active states
  useEffect(() => {
    if (!editor) return;

    const handleUpdate = () => {
      setTick((t) => t + 1);
    };

    editor.on('selectionUpdate', handleUpdate);
    editor.on('transaction', handleUpdate);

    return () => {
      editor.off('selectionUpdate', handleUpdate);
      editor.off('transaction', handleUpdate);
    };
  }, [editor]);

  if (!editor) return null;

  const getBtnStyle = (isActive: boolean) => ({
    color: 'var(--note-toolbar-icon)',
    backgroundColor: isActive ? 'var(--note-toolbar-active)' : 'transparent',
  });

  const btnClass =
    'w-6 h-6 flex items-center justify-center rounded transition-colors hover:bg-[var(--note-toolbar-hover)] cursor-pointer shrink-0';

  const handleToggleH1 = () => {
    if (editor.isActive('heading', { level: 1 })) {
      editor.chain().focus().setParagraph().run();
    } else {
      editor.chain().focus().toggleHeading({ level: 1 }).run();
    }
  };

  const handleToggleH2 = () => {
    if (editor.isActive('heading', { level: 2 })) {
      editor.chain().focus().setParagraph().run();
    } else {
      editor.chain().focus().toggleHeading({ level: 2 }).run();
    }
  };

  const handleAlignLeft = () => {
    editor.chain().focus().setTextAlign('left').run();
  };

  const handleAlignRight = () => {
    if (editor.isActive({ textAlign: 'right' })) {
      editor.chain().focus().setTextAlign('left').run();
    } else {
      editor.chain().focus().setTextAlign('right').run();
    }
  };

  return (
    <div
      className="h-8 px-2 border-t border-black/10 dark:border-white/15 flex items-center gap-0.5 select-none bg-transparent overflow-x-auto no-scrollbar"
      style={{ borderColor: 'var(--note-border)' }}
    >
      {/* Headings - 1-Click Toggle to Heading & 1-Click Back to Normal Text */}
      <button
        onClick={handleToggleH1}
        className={btnClass}
        style={getBtnStyle(editor.isActive('heading', { level: 1 }))}
        title={
          editor.isActive('heading', { level: 1 })
            ? 'Remove Heading (Turn into normal text)'
            : 'Heading 1 (#)'
        }
      >
        <Heading1 size={13} strokeWidth={2.4} />
      </button>
      <button
        onClick={handleToggleH2}
        className={btnClass}
        style={getBtnStyle(editor.isActive('heading', { level: 2 }))}
        title={
          editor.isActive('heading', { level: 2 })
            ? 'Remove Heading (Turn into normal text)'
            : 'Heading 2 (##)'
        }
      >
        <Heading2 size={13} strokeWidth={2.4} />
      </button>

      <div
        className="w-[1px] h-3.5 mx-0.5 opacity-30"
        style={{ backgroundColor: 'var(--note-toolbar-icon)' }}
      />

      {/* Text Formats */}
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

      {/* Alignment */}
      <button
        onClick={handleAlignLeft}
        className={btnClass}
        style={getBtnStyle(editor.isActive({ textAlign: 'left' }))}
        title="Align Left"
      >
        <AlignLeft size={13} strokeWidth={2.4} />
      </button>
      <button
        onClick={handleAlignRight}
        className={btnClass}
        style={getBtnStyle(editor.isActive({ textAlign: 'right' }))}
        title="Align Right"
      >
        <AlignRight size={13} strokeWidth={2.4} />
      </button>

      <div
        className="w-[1px] h-3.5 mx-0.5 opacity-30"
        style={{ backgroundColor: 'var(--note-toolbar-icon)' }}
      />

      {/* Lists */}
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

      {/* Blocks */}
      <button
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        className={btnClass}
        style={getBtnStyle(editor.isActive('codeBlock'))}
        title="Code Block (```)"
      >
        <Code size={13} strokeWidth={2.3} />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={btnClass}
        style={getBtnStyle(editor.isActive('blockquote'))}
        title="Quote (>)"
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
