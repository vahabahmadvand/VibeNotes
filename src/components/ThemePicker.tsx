import React from 'react';
import type { NoteTheme } from '../types';

interface ThemePickerProps {
  currentTheme: NoteTheme;
  onSelectTheme: (theme: NoteTheme) => void;
  onClose: () => void;
}

const THEMES: { id: NoteTheme; name: string; bg: string; border: string }[] = [
  { id: 'yellow', name: 'Yellow', bg: '#fffab3', border: '#fde047' },
  { id: 'green', name: 'Green', bg: '#dcfce7', border: '#86efac' },
  { id: 'pink', name: 'Pink', bg: '#fce7f3', border: '#f472b6' },
  { id: 'purple', name: 'Purple', bg: '#f3e8ff', border: '#c084fc' },
  { id: 'blue', name: 'Blue', bg: '#e0f2fe', border: '#38bdf8' },
  { id: 'charcoal', name: 'Charcoal', bg: '#27272a', border: '#52525b' },
  { id: 'grey', name: 'Grey', bg: '#f4f4f5', border: '#cbd5e1' },
];

export const ThemePicker: React.FC<ThemePickerProps> = ({
  currentTheme,
  onSelectTheme,
  onClose,
}) => {
  return (
    <div
      className="absolute top-9 right-2 z-50 p-2 rounded-lg bg-white/95 dark:bg-zinc-800/95 backdrop-blur-md shadow-xl border border-black/10 dark:border-white/10 flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-100"
      onMouseLeave={onClose}
    >
      {THEMES.map((theme) => (
        <button
          key={theme.id}
          onClick={() => {
            onSelectTheme(theme.id);
            onClose();
          }}
          className={`w-6 h-6 rounded-full border transition-transform hover:scale-110 flex items-center justify-center ${
            currentTheme === theme.id ? 'ring-2 ring-blue-500 scale-105' : ''
          }`}
          style={{ backgroundColor: theme.bg, borderColor: theme.border }}
          title={theme.name}
        >
          {currentTheme === theme.id && (
            <span className={`text-[10px] font-bold ${theme.id === 'charcoal' ? 'text-white' : 'text-zinc-800'}`}>
              ✓
            </span>
          )}
        </button>
      ))}
    </div>
  );
};
