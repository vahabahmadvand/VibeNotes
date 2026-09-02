import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import {
  Search,
  Plus,
  Pin,
  Trash2,
  ExternalLink,
  Power,
  X,
  Archive,
  ArchiveRestore,
  LayoutGrid,
  Eye,
  EyeOff,
  Sparkles,
} from 'lucide-react';
import type { Note } from '../types';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { UpdateModal } from './UpdateModal';

const COLOR_FILTERS: { id: string; name: string; bg: string }[] = [
  { id: 'all', name: 'All Colors', bg: '#94a3b8' },
  { id: 'yellow', name: 'Yellow', bg: '#fef08a' },
  { id: 'green', name: 'Green', bg: '#bbf7d0' },
  { id: 'pink', name: 'Pink', bg: '#fbcfe8' },
  { id: 'purple', name: 'Purple', bg: '#e9d5ff' },
  { id: 'blue', name: 'Blue', bg: '#bae6fd' },
  { id: 'charcoal', name: 'Charcoal', bg: '#27272a' },
  { id: 'grey', name: 'Grey', bg: '#e4e4e7' },
];

export const NotesHub: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedColor, setSelectedColor] = useState('all');
  const [viewTab, setViewTab] = useState<'active' | 'archived'>('active');
  const [autostartEnabled, setAutostartEnabled] = useState(false);
  const [iconSize, setIconSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [appVersion, setAppVersion] = useState<string>('');

  // Load notes & autostart status
  const fetchNotes = async () => {
    try {
      const data = await invoke<Note[]>('get_all_notes', {
        includeArchived: true,
      });
      setNotes(data);

      const auto = await invoke<boolean>('get_autostart_status');
      setAutostartEnabled(auto);
    } catch (err) {
      console.error('Failed to load notes in hub:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getVersion().then(setAppVersion).catch(() => setAppVersion('0.3.2'));
    fetchNotes();
    const interval = setInterval(fetchNotes, 2500);
    return () => clearInterval(interval);
  }, []);

  const handleToggleAutostart = async () => {
    try {
      const next = !autostartEnabled;
      const res = await invoke<boolean>('toggle_autostart', { enable: next });
      setAutostartEnabled(res);
    } catch (err) {
      console.error('Failed to toggle autostart:', err);
    }
  };

  const handleCycleIconSize = () => {
    if (iconSize === 'small') setIconSize('medium');
    else if (iconSize === 'medium') setIconSize('large');
    else setIconSize('small');
  };

  const handleShowAll = async () => {
    try {
      await invoke('show_all_notes');
      await fetchNotes();
    } catch (err) {
      console.error('Failed to show all notes:', err);
    }
  };

  const handleHideAll = async () => {
    try {
      await invoke('hide_all_notes');
      await fetchNotes();
    } catch (err) {
      console.error('Failed to hide all notes:', err);
    }
  };

  const handleCreateNote = async () => {
    try {
      await invoke('create_new_note', {
        colorTheme: selectedColor !== 'all' ? selectedColor : 'yellow',
      });
      await fetchNotes();
    } catch (err) {
      console.error('Failed to create note:', err);
    }
  };

  const handleOpenNote = async (id: string) => {
    try {
      await invoke('open_note_window', { id });
      await fetchNotes();
    } catch (err) {
      console.error('Failed to open note:', err);
    }
  };

  const handleTogglePin = async (id: string, currentPin: boolean) => {
    try {
      await invoke('set_note_pinned', { id, pinned: !currentPin });
      await fetchNotes();
    } catch (err) {
      console.error('Failed to pin note:', err);
    }
  };

  const handleToggleArchive = async (id: string, currentArchived: boolean) => {
    try {
      await invoke('archive_note', { id, isArchived: !currentArchived });
      await fetchNotes();
    } catch (err) {
      console.error('Failed to archive note:', err);
    }
  };

  const handleConfirmDelete = async () => {
    if (!noteToDelete) return;
    try {
      await invoke('delete_note_permanent', { id: noteToDelete.id });
      setNoteToDelete(null);
      await fetchNotes();
    } catch (err) {
      console.error('Failed to delete note:', err);
    }
  };

  const handleCloseHub = async () => {
    try {
      await invoke('close_hub_window');
    } catch (err) {
      console.error('Failed to close hub window:', err);
    }
  };

  // Filter notes
  const filteredNotes = notes.filter((note) => {
    const matchesTab = viewTab === 'active' ? !note.is_archived : note.is_archived;
    const matchesColor = selectedColor === 'all' || note.color_theme === selectedColor;
    const matchesQuery =
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content_raw.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesColor && matchesQuery;
  });

  const gridColsClass =
    iconSize === 'small'
      ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'
      : iconSize === 'large'
      ? 'grid-cols-1 sm:grid-cols-2'
      : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3';

  return (
    <div className="h-screen w-screen flex flex-col bg-[#f8fafc] dark:bg-[#0f172a] text-slate-800 dark:text-slate-100 select-none overflow-hidden font-sans">
      {/* Frameless Header Drag Region */}
      <div
        data-tauri-drag-region
        className="h-10 px-3 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 select-none cursor-move shrink-0"
      >
        <div className="flex items-center gap-2" data-tauri-drag-region>
          <div className="w-5 h-5 rounded bg-amber-400 flex items-center justify-center font-bold text-xs text-amber-950 shadow-xs">
            V
          </div>
          <span className="font-semibold text-xs tracking-wide">VibeNotes Hub</span>
          <button
            onClick={() => setShowUpdateModal(true)}
            className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors cursor-pointer"
            title="Check for updates"
          >
            v{appVersion || '0.3.2'}
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCloseHub}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            title="Close Hub"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Main Hub Content */}
      <div className="flex-1 flex flex-col p-4 overflow-hidden gap-3">
        {/* Controls Bar: Search & Actions */}
        <div className="flex items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search notes or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={handleCreateNote}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-amber-950 font-medium text-xs rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <Plus size={14} />
              <span>New Note</span>
            </button>

            {/* Show / Hide All Notes buttons */}
            <button
              onClick={handleShowAll}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              title="Show all notes on desktop"
            >
              <Eye size={13} />
              <span>Show All</span>
            </button>

            <button
              onClick={handleHideAll}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              title="Hide all floating notes"
            >
              <EyeOff size={13} />
              <span>Hide All</span>
            </button>

            {/* Check For Updates button */}
            <button
              onClick={() => setShowUpdateModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              title="Check for updates from GitHub"
            >
              <Sparkles size={13} className="text-amber-500" />
              <span>Updates</span>
            </button>

            {/* Windows Startup Option */}
            <button
              onClick={handleToggleAutostart}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                autostartEnabled
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
              }`}
              title="Launch VibeNotes when Windows boots"
            >
              <Power size={13} className={autostartEnabled ? 'text-emerald-600' : 'text-slate-400'} />
              <span>Startup: {autostartEnabled ? 'On' : 'Off'}</span>
            </button>

            {/* Icon Size Toggle right next to Startup Option */}
            <button
              onClick={handleCycleIconSize}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              title={`Card Size: ${iconSize.toUpperCase()} (Click to toggle)`}
            >
              <LayoutGrid size={13} className="text-slate-500" />
              <span className="capitalize">Size: {iconSize}</span>
            </button>
          </div>
        </div>

        {/* Filters and Tabs */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
          {/* Tabs */}
          <div className="flex items-center gap-1 bg-slate-200/70 dark:bg-slate-800/80 p-0.5 rounded-lg text-xs font-medium">
            <button
              onClick={() => setViewTab('active')}
              className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                viewTab === 'active'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Active Notes ({notes.filter((n) => !n.is_archived).length})
            </button>
            <button
              onClick={() => setViewTab('archived')}
              className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                viewTab === 'archived'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Archive ({notes.filter((n) => n.is_archived).length})
            </button>
          </div>

          {/* Color Filter Dots */}
          <div className="flex items-center gap-1">
            {COLOR_FILTERS.map((col) => (
              <button
                key={col.id}
                onClick={() => setSelectedColor(col.id)}
                className={`w-5 h-5 rounded-full border transition-all flex items-center justify-center cursor-pointer ${
                  selectedColor === col.id ? 'ring-2 ring-blue-500 scale-110' : 'opacity-70 hover:opacity-100'
                }`}
                style={{ backgroundColor: col.bg, borderColor: 'rgba(0,0,0,0.15)' }}
                title={col.name}
              />
            ))}
          </div>
        </div>

        {/* Notes Grid */}
        <div className="flex-1 overflow-y-auto pr-1">
          {loading ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-400">
              Loading notes...
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <Archive size={36} className="opacity-30 mb-2" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">No notes found</p>
              <p className="text-xs mt-0.5">
                {searchQuery
                  ? 'Try searching for something else.'
                  : viewTab === 'active'
                  ? 'Click "+ New Note" to create your first sticky note.'
                  : 'No archived notes.'}
              </p>
            </div>
          ) : (
            <div className={`grid ${gridColsClass} gap-3`}>
              {filteredNotes.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleOpenNote(n.id)}
                  className={`group relative flex flex-col ${
                    iconSize === 'small' ? 'p-2.5 text-[11px]' : iconSize === 'large' ? 'p-4 text-sm' : 'p-3 text-xs'
                  } rounded-xl border transition-all cursor-pointer hover:shadow-md hover:-translate-y-0.5 theme-${n.color_theme}`}
                  style={{
                    backgroundColor: 'var(--note-bg)',
                    borderColor: 'var(--note-border)',
                    color: 'var(--note-text)',
                  }}
                >
                  {/* Card Header */}
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <span className="font-semibold text-xs truncate max-w-[170px]">
                      {n.title || 'Untitled Note'}
                    </span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTogglePin(n.id, n.is_pinned);
                        }}
                        className={`p-1 rounded hover:bg-black/10 transition-colors cursor-pointer ${
                          n.is_pinned ? 'text-blue-600 opacity-100' : ''
                        }`}
                        title={n.is_pinned ? 'Unpin' : 'Pin to top'}
                      >
                        <Pin size={12} className={n.is_pinned ? 'fill-current' : ''} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleArchive(n.id, n.is_archived);
                        }}
                        className="p-1 rounded hover:bg-black/10 transition-colors cursor-pointer"
                        title={n.is_archived ? 'Restore note' : 'Archive note'}
                      >
                        {n.is_archived ? <ArchiveRestore size={12} /> : <Archive size={12} />}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setNoteToDelete(n);
                        }}
                        className="p-1 rounded hover:bg-red-500 hover:text-white transition-colors cursor-pointer"
                        title="Delete permanently"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Card Body Snippet */}
                  <p
                    className={`${
                      iconSize === 'small'
                        ? 'line-clamp-2 text-[11px]'
                        : iconSize === 'large'
                        ? 'line-clamp-6 text-[13px]'
                        : 'line-clamp-4 text-xs'
                    } leading-relaxed opacity-85 select-none font-normal`}
                  >
                    {n.content_raw || 'Empty note...'}
                  </p>

                  {/* Card Footer Info */}
                  <div className="mt-3 pt-2 border-t border-black/5 flex items-center justify-between text-[10px] opacity-60">
                    <span>
                      {new Date(n.updated_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <div className="flex items-center gap-1">
                      {n.is_open && (
                        <span
                          className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"
                          title="Open on desktop"
                        />
                      )}
                      <ExternalLink size={10} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={Boolean(noteToDelete)}
        noteTitle={noteToDelete?.title || ''}
        onConfirm={handleConfirmDelete}
        onCancel={() => setNoteToDelete(null)}
      />

      {/* App Update Modal */}
      <UpdateModal
        isOpen={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
      />
    </div>
  );
};
