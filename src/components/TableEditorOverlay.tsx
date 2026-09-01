import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Editor } from '@tiptap/react';
import {
  Trash2,
  Plus,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Columns,
  Rows,
} from 'lucide-react';

interface TableEditorOverlayProps {
  editor: Editor | null;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

interface TablePositions {
  tableRect: { top: number; left: number; width: number; height: number };
  cellRect: { top: number; left: number; width: number; height: number };
  isHeaderCell: boolean;
}

export const TableEditorOverlay: React.FC<TableEditorOverlayProps> = ({
  editor,
  containerRef,
}) => {
  const [positions, setPositions] = useState<TablePositions | null>(null);
  const activeTableElRef = useRef<HTMLTableElement | null>(null);

  const updatePositions = useCallback(() => {
    if (!editor || editor.isDestroyed || !containerRef.current) {
      setPositions(null);
      return;
    }

    if (!editor.isActive('table')) {
      setPositions(null);
      activeTableElRef.current = null;
      return;
    }

    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();

    // Find active cell element
    let cellEl: HTMLTableCellElement | null = null;
    let tableEl: HTMLTableElement | null = null;

    try {
      const selection = window.getSelection();
      if (selection && selection.anchorNode) {
        const node =
          selection.anchorNode instanceof HTMLElement
            ? selection.anchorNode
            : selection.anchorNode.parentElement;
        if (node) {
          cellEl = node.closest('td, th');
          tableEl = node.closest('table');
        }
      }

      // Fallback if not found via DOM selection
      if (!cellEl || !tableEl) {
        const pos = editor.state.selection.from;
        const domPos = editor.view.domAtPos(pos);
        const node =
          domPos.node instanceof HTMLElement
            ? domPos.node
            : domPos.node.parentElement;
        if (node) {
          cellEl = node.closest('td, th');
          tableEl = node.closest('table');
        }
      }

      // Secondary fallback to any selectedCell or first cell in table
      if (!tableEl) {
        tableEl = editor.view.dom.querySelector('table');
      }
      if (tableEl && !cellEl) {
        cellEl =
          tableEl.querySelector('.selectedCell') ||
          tableEl.querySelector('td, th');
      }
    } catch {
      // Ignored
    }

    if (!tableEl || !cellEl) {
      setPositions(null);
      return;
    }

    activeTableElRef.current = tableEl;

    const tRect = tableEl.getBoundingClientRect();
    const cRect = cellEl.getBoundingClientRect();

    // Calculate relative coordinates with scroll offset
    const scrollLeft = container.scrollLeft;
    const scrollTop = container.scrollTop;

    setPositions({
      tableRect: {
        top: tRect.top - containerRect.top + scrollTop,
        left: tRect.left - containerRect.left + scrollLeft,
        width: tRect.width,
        height: tRect.height,
      },
      cellRect: {
        top: cRect.top - containerRect.top + scrollTop,
        left: cRect.left - containerRect.left + scrollLeft,
        width: cRect.width,
        height: cRect.height,
      },
      isHeaderCell: cellEl.tagName.toLowerCase() === 'th',
    });
  }, [editor, containerRef]);

  useEffect(() => {
    if (!editor) return;

    const handleUpdate = () => {
      // Small timeout to allow DOM to settle after transaction
      requestAnimationFrame(updatePositions);
    };

    editor.on('selectionUpdate', handleUpdate);
    editor.on('transaction', handleUpdate);
    editor.on('focus', handleUpdate);

    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', updatePositions, { passive: true });
    }

    window.addEventListener('resize', updatePositions);

    // Initial check
    const rafId = requestAnimationFrame(updatePositions);

    return () => {
      cancelAnimationFrame(rafId);
      editor.off('selectionUpdate', handleUpdate);
      editor.off('transaction', handleUpdate);
      editor.off('focus', handleUpdate);
      if (container) {
        container.removeEventListener('scroll', updatePositions);
      }
      window.removeEventListener('resize', updatePositions);
    };
  }, [editor, containerRef, updatePositions]);

  if (!editor || !positions) {
    return null;
  }

  const { tableRect, cellRect } = positions;

  // Handler helpers with preventDefault to avoid losing editor focus
  const preventFocusLoss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDeleteTable = (e: React.MouseEvent) => {
    preventFocusLoss(e);
    editor.chain().focus().deleteTable().run();
    setPositions(null);
  };

  const handleAddColumnAfter = (e: React.MouseEvent) => {
    preventFocusLoss(e);
    editor.chain().focus().addColumnAfter().run();
  };

  const handleAddColumnBefore = (e: React.MouseEvent) => {
    preventFocusLoss(e);
    editor.chain().focus().addColumnBefore().run();
  };

  const handleDeleteColumn = (e: React.MouseEvent) => {
    preventFocusLoss(e);
    editor.chain().focus().deleteColumn().run();
  };

  const handleAddRowAfter = (e: React.MouseEvent) => {
    preventFocusLoss(e);
    editor.chain().focus().addRowAfter().run();
  };

  const handleAddRowBefore = (e: React.MouseEvent) => {
    preventFocusLoss(e);
    editor.chain().focus().addRowBefore().run();
  };

  const handleDeleteRow = (e: React.MouseEvent) => {
    preventFocusLoss(e);
    editor.chain().focus().deleteRow().run();
  };

  return (
    <div className="table-editor-overlay pointer-events-none absolute inset-0 z-20">
      {/* 1. Corner Delete Table Button */}
      <div
        className="pointer-events-auto absolute transition-opacity duration-150"
        style={{
          top: Math.max(0, tableRect.top - 12),
          left: Math.max(0, tableRect.left + tableRect.width - 12),
        }}
      >
        <button
          type="button"
          onMouseDown={preventFocusLoss}
          onClick={handleDeleteTable}
          title="Delete Table"
          className="group flex h-6 w-6 items-center justify-center rounded-full bg-red-500/90 text-white shadow-md transition-all hover:scale-110 hover:bg-red-600 active:scale-95 cursor-pointer"
        >
          <Trash2 size={12} strokeWidth={2.4} />
        </button>
      </div>

      {/* 2. Inline Column Quick-Add Button (Right edge of Selected Cell) */}
      <div
        className="pointer-events-auto absolute transition-all duration-150"
        style={{
          top: cellRect.top,
          left: cellRect.left + cellRect.width - 8,
          height: cellRect.height,
        }}
      >
        <div className="flex h-full items-center">
          <button
            type="button"
            onMouseDown={preventFocusLoss}
            onClick={handleAddColumnAfter}
            title="Insert column right (+)"
            className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white shadow-sm transition-transform hover:scale-125 hover:bg-blue-600 active:scale-95 cursor-pointer z-30"
          >
            <Plus size={10} strokeWidth={3} />
          </button>
        </div>
      </div>

      {/* 3. Inline Row Quick-Add Button (Bottom edge of Selected Cell) */}
      <div
        className="pointer-events-auto absolute transition-all duration-150"
        style={{
          top: cellRect.top + cellRect.height - 8,
          left: cellRect.left,
          width: cellRect.width,
        }}
      >
        <div className="flex w-full justify-center">
          <button
            type="button"
            onMouseDown={preventFocusLoss}
            onClick={handleAddRowAfter}
            title="Insert row below (+)"
            className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm transition-transform hover:scale-125 hover:bg-emerald-600 active:scale-95 cursor-pointer z-30"
          >
            <Plus size={10} strokeWidth={3} />
          </button>
        </div>
      </div>

      {/* 4. Table Quick Append Column Button (Right edge of whole table) */}
      <div
        className="pointer-events-auto absolute transition-all duration-150"
        style={{
          top: tableRect.top + tableRect.height / 2 - 10,
          left: tableRect.left + tableRect.width + 4,
        }}
      >
        <button
          type="button"
          onMouseDown={preventFocusLoss}
          onClick={handleAddColumnAfter}
          title="Add column to right"
          className="flex h-5 items-center gap-0.5 rounded px-1.5 text-[10px] font-semibold bg-black/10 hover:bg-blue-500 hover:text-white dark:bg-white/10 dark:hover:bg-blue-500 transition-colors cursor-pointer shadow-xs"
          style={{ color: 'var(--note-text)' }}
        >
          <Plus size={11} strokeWidth={2.5} />
          <span>Col</span>
        </button>
      </div>

      {/* 5. Table Quick Append Row Button (Bottom edge of whole table) */}
      <div
        className="pointer-events-auto absolute transition-all duration-150"
        style={{
          top: tableRect.top + tableRect.height + 4,
          left: tableRect.left + tableRect.width / 2 - 24,
        }}
      >
        <button
          type="button"
          onMouseDown={preventFocusLoss}
          onClick={handleAddRowAfter}
          title="Add row below"
          className="flex h-5 items-center gap-0.5 rounded px-2 text-[10px] font-semibold bg-black/10 hover:bg-emerald-500 hover:text-white dark:bg-white/10 dark:hover:bg-emerald-500 transition-colors cursor-pointer shadow-xs"
          style={{ color: 'var(--note-text)' }}
        >
          <Plus size={11} strokeWidth={2.5} />
          <span>Row</span>
        </button>
      </div>

      {/* 6. Selected Cell / Row / Column Floating Action Toolbar */}
      <div
        className="pointer-events-auto absolute transition-all duration-150"
        style={{
          top: Math.max(4, cellRect.top - 32),
          left: Math.max(4, Math.min(cellRect.left, tableRect.left + tableRect.width - 170)),
        }}
      >
        <div
          className="flex items-center gap-0.5 rounded-md border border-black/15 bg-[var(--note-bg)] p-0.5 shadow-lg backdrop-blur-xs text-[11px] select-none dark:border-white/20"
          style={{
            borderColor: 'var(--note-border)',
            color: 'var(--note-text)',
          }}
        >
          {/* Column Actions Group */}
          <div className="flex items-center gap-0.5 px-0.5">
            <span className="opacity-50 text-[10px] mr-0.5">
              <Columns size={10} />
            </span>
            <button
              type="button"
              onMouseDown={preventFocusLoss}
              onClick={handleAddColumnBefore}
              title="Add column left"
              className="flex h-5 w-5 items-center justify-center rounded hover:bg-[var(--note-toolbar-hover)] transition-colors cursor-pointer"
            >
              <ArrowLeft size={11} strokeWidth={2.4} />
            </button>
            <button
              type="button"
              onMouseDown={preventFocusLoss}
              onClick={handleAddColumnAfter}
              title="Add column right"
              className="flex h-5 w-5 items-center justify-center rounded hover:bg-[var(--note-toolbar-hover)] transition-colors cursor-pointer"
            >
              <ArrowRight size={11} strokeWidth={2.4} />
            </button>
            <button
              type="button"
              onMouseDown={preventFocusLoss}
              onClick={handleDeleteColumn}
              title="Delete current column"
              className="flex h-5 w-5 items-center justify-center rounded text-red-500 hover:bg-red-500/15 transition-colors cursor-pointer"
            >
              <Trash2 size={11} strokeWidth={2.4} />
            </button>
          </div>

          <div
            className="h-3.5 w-[1px] opacity-25"
            style={{ backgroundColor: 'var(--note-text)' }}
          />

          {/* Row Actions Group */}
          <div className="flex items-center gap-0.5 px-0.5">
            <span className="opacity-50 text-[10px] mr-0.5">
              <Rows size={10} />
            </span>
            <button
              type="button"
              onMouseDown={preventFocusLoss}
              onClick={handleAddRowBefore}
              title="Add row above"
              className="flex h-5 w-5 items-center justify-center rounded hover:bg-[var(--note-toolbar-hover)] transition-colors cursor-pointer"
            >
              <ArrowUp size={11} strokeWidth={2.4} />
            </button>
            <button
              type="button"
              onMouseDown={preventFocusLoss}
              onClick={handleAddRowAfter}
              title="Add row below"
              className="flex h-5 w-5 items-center justify-center rounded hover:bg-[var(--note-toolbar-hover)] transition-colors cursor-pointer"
            >
              <ArrowDown size={11} strokeWidth={2.4} />
            </button>
            <button
              type="button"
              onMouseDown={preventFocusLoss}
              onClick={handleDeleteRow}
              title="Delete current row"
              className="flex h-5 w-5 items-center justify-center rounded text-red-500 hover:bg-red-500/15 transition-colors cursor-pointer"
            >
              <Trash2 size={11} strokeWidth={2.4} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
