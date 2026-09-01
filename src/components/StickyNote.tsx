import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useEditor, EditorContent, ReactNodeViewRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import { all, createLowlight } from 'lowlight';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  Plus,
  Pin,
  MoreHorizontal,
  Trash2,
  X,
  ListFilter,
} from 'lucide-react';
import type { Note, NoteTheme } from '../types';
import { CodeBlockView } from './CodeBlockView';
import { ThemePicker } from './ThemePicker';
import { FormatToolbar } from './FormatToolbar';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { TableEditorOverlay } from './TableEditorOverlay';

const lowlight = createLowlight(all);

interface StickyNoteProps {
  noteId: string;
}

export const StickyNote: React.FC<StickyNoteProps> = ({ noteId }) => {
  const [note, setNote] = useState<Note | null>(null);
  const [theme, setTheme] = useState<NoteTheme>('yellow');
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const appWindow = getCurrentWindow();
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorContainerRef = useRef<HTMLDivElement | null>(null);

  // Load Note from SQLite
  useEffect(() => {
    async function loadNote() {
      try {
        const data = await invoke<Note | null>('get_note_by_id', { id: noteId });
        if (data) {
          setNote(data);
          setTheme(data.color_theme as NoteTheme);
          setIsAlwaysOnTop(data.is_always_on_top);
        }
      } catch (err) {
        console.error('Failed to load note:', err);
      } finally {
        setLoading(false);
      }
    }
    loadNote();
  }, [noteId]);

  // Debounced Save function
  const triggerAutoSave = useCallback(
    (jsonContent: string, rawText: string) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(async () => {
        try {
          const pos = await appWindow.outerPosition();
          const size = await appWindow.outerSize();

          await invoke('save_note_content', {
            payload: {
              id: noteId,
              content_raw: rawText,
              content_json: jsonContent,
              window_x: pos.x,
              window_y: pos.y,
              window_width: size.width,
              window_height: size.height,
            },
          });
        } catch (err) {
          console.error('Failed to auto-save note:', err);
        }
      }, 350);
    },
    [noteId, appWindow]
  );

  // TipTap Editor instance
  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          codeBlock: false,
        }),
        TaskList,
        TaskItem.configure({
          nested: true,
        }),
        CodeBlockLowlight.extend({
          addNodeView() {
            return ReactNodeViewRenderer(CodeBlockView);
          },
        }).configure({ lowlight }),
        Table.configure({
          resizable: true,
        }),
        TableRow,
        TableHeader,
        TableCell,
        Underline,
        Link.configure({
          openOnClick: true,
        }),
        Image.configure({
          inline: true,
          allowBase64: true,
        }),
        Placeholder.configure({
          placeholder: 'Take a note...',
        }),
      ],
      content: note?.content_json ? JSON.parse(note.content_json) : '<p></p>',
      editorProps: {
        attributes: {
          class: 'outline-none min-h-full px-3.5 py-2',
        },
        handleDOMEvents: {
          drop: (view, event) => {
            const hasFiles = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length;
            if (!hasFiles) return false;

            const file = event.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
              event.preventDefault();
              const reader = new FileReader();
              reader.onload = (readerEvent) => {
                const base64 = readerEvent.target?.result as string;
                if (base64) {
                  const node = view.state.schema.nodes.image.create({ src: base64 });
                  const transaction = view.state.tr.insert(view.state.selection.from, node);
                  view.dispatch(transaction);
                }
              };
              reader.readAsDataURL(file);
              return true;
            }
            return false;
          },
        },
      },
      onUpdate: ({ editor }) => {
        const json = JSON.stringify(editor.getJSON());
        const raw = editor.getText();
        triggerAutoSave(json, raw);
      },
    },
    [loading]
  );

  // Toggle Always on Top
  const handleTogglePin = async () => {
    const nextState = !isAlwaysOnTop;
    setIsAlwaysOnTop(nextState);
    try {
      await invoke('set_note_always_on_top', { id: noteId, alwaysOnTop: nextState });
    } catch (err) {
      console.error('Failed to set always on top:', err);
    }
  };

  // Change Theme Color
  const handleSelectTheme = async (newTheme: NoteTheme) => {
    setTheme(newTheme);
    try {
      await invoke('set_note_theme', { id: noteId, colorTheme: newTheme });
    } catch (err) {
      console.error('Failed to set note theme:', err);
    }
  };

  // Create New Note
  const handleCreateNew = async () => {
    try {
      const pos = await appWindow.outerPosition();
      await invoke('create_new_note', {
        colorTheme: theme,
        x: pos.x + 30,
        y: pos.y + 30,
      });
    } catch (err) {
      console.error('Failed to create new note:', err);
    }
  };

  // Open Hub Manager
  const handleOpenHub = async () => {
    try {
      await invoke('open_hub_window');
    } catch (err) {
      console.error('Failed to open hub:', err);
    }
  };

  // Close Window
  const handleClose = async () => {
    try {
      await invoke('close_note_window', { id: noteId });
    } catch (err) {
      console.error('Failed to close note window:', err);
    }
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    try {
      await invoke('delete_note_permanent', { id: noteId });
    } catch (err) {
      console.error('Failed to delete note:', err);
    }
  };

  if (loading) {
    return <div className="h-screen w-screen bg-amber-50" />;
  }

  return (
    <div
      className={`h-screen w-screen flex flex-col theme-${theme} relative select-none`}
      style={{ backgroundColor: 'var(--note-bg)', color: 'var(--note-text)' }}
    >
      {/* Frameless Top Drag Bar */}
      <div
        data-tauri-drag-region
        className="h-8 px-2 flex items-center justify-between border-b border-black/10 dark:border-white/10 select-none cursor-move shrink-0"
        style={{ backgroundColor: 'var(--note-header)' }}
      >
        {/* Left Actions */}
        <div className="flex items-center gap-1" data-tauri-drag-region>
          <button
            onClick={handleCreateNew}
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--note-toolbar-hover)] transition-colors cursor-pointer"
            style={{ color: 'var(--note-toolbar-icon)' }}
            title="New note (Ctrl+N)"
          >
            <Plus size={13} strokeWidth={2.3} />
          </button>
          <button
            onClick={handleTogglePin}
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--note-toolbar-hover)] transition-colors cursor-pointer"
            style={{
              color: 'var(--note-toolbar-icon)',
              backgroundColor: isAlwaysOnTop ? 'var(--note-toolbar-active)' : 'transparent',
            }}
            title={isAlwaysOnTop ? 'Always on Top (Active)' : 'Always on Top'}
          >
            <Pin size={12} strokeWidth={2.3} className={isAlwaysOnTop ? 'fill-current' : ''} />
          </button>
          <button
            onClick={handleOpenHub}
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--note-toolbar-hover)] transition-colors cursor-pointer"
            style={{ color: 'var(--note-toolbar-icon)' }}
            title="Notes Hub"
          >
            <ListFilter size={12} strokeWidth={2.3} />
          </button>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-1">
          <div className="relative">
            <button
              onClick={() => setShowThemePicker(!showThemePicker)}
              className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--note-toolbar-hover)] transition-colors cursor-pointer"
              style={{ color: 'var(--note-toolbar-icon)' }}
              title="Change color"
            >
              <MoreHorizontal size={13} strokeWidth={2.3} />
            </button>
            {showThemePicker && (
              <ThemePicker
                currentTheme={theme}
                onSelectTheme={handleSelectTheme}
                onClose={() => setShowThemePicker(false)}
              />
            )}
          </div>

          <button
            onClick={() => setShowDeleteModal(true)}
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-500 hover:text-white transition-colors cursor-pointer"
            style={{ color: 'var(--note-toolbar-icon)' }}
            title="Delete note"
          >
            <Trash2 size={12} strokeWidth={2.3} />
          </button>

          <button
            onClick={handleClose}
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-black/15 dark:hover:bg-white/20 transition-colors ml-0.5 cursor-pointer"
            style={{ color: 'var(--note-toolbar-icon)' }}
            title="Close"
          >
            <X size={13} strokeWidth={2.3} />
          </button>
        </div>
      </div>

      {/* Main ProseMirror Editor Canvas */}
      <div ref={editorContainerRef} className="flex-1 overflow-y-auto relative">
        <EditorContent editor={editor} className="min-h-full" />
        <TableEditorOverlay editor={editor} containerRef={editorContainerRef} />
      </div>

      {/* Bottom Format Toolbar */}
      <FormatToolbar editor={editor} />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmModal
        isOpen={showDeleteModal}
        noteTitle={note?.title || ''}
        onConfirm={handleConfirmDelete}
        onCancel={() => setShowDeleteModal(false)}
      />
    </div>
  );
};
