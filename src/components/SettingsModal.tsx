import React from 'react';
import {
  Settings,
  X,
  Sparkles,
  RefreshCw,
  Laptop,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  autostartEnabled: boolean;
  onToggleAutostart: () => void;
  autoCheckUpdates: boolean;
  onToggleAutoCheckUpdates: () => void;
  appVersion: string;
  onOpenUpdates: () => void;
  hasUpdateAvailable?: boolean;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  autostartEnabled,
  onToggleAutostart,
  autoCheckUpdates,
  onToggleAutoCheckUpdates,
  appVersion,
  onOpenUpdates,
  hasUpdateAvailable = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 select-none">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 w-full max-w-md p-5 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150 text-slate-800 dark:text-zinc-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Settings size={18} />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Settings</h3>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                Application preferences & configuration
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        {/* Settings Body */}
        <div className="flex flex-col gap-3.5 py-1">
          {/* Section: Startup & Background */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-1">
              Startup & System
            </span>
            <div className="mt-1.5 flex flex-col gap-2 bg-slate-50 dark:bg-zinc-800/50 border border-slate-200/80 dark:border-zinc-800 rounded-xl p-3">
              {/* Windows Startup Toggle */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center mt-0.5 shrink-0">
                    <Laptop size={15} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-medium">Start with Windows</span>
                    <span className="text-[11px] text-slate-500 dark:text-zinc-400 leading-tight">
                      Launch automatically in system tray on boot
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onToggleAutostart}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    autostartEnabled ? 'bg-amber-500' : 'bg-slate-300 dark:bg-zinc-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      autostartEnabled ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="h-px bg-slate-200/60 dark:bg-zinc-700/50 my-0.5" />

              {/* Auto Check Updates Toggle */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center mt-0.5 shrink-0">
                    <RefreshCw size={15} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-medium">Check for updates at startup</span>
                    <span className="text-[11px] text-slate-500 dark:text-zinc-400 leading-tight">
                      Automatically check GitHub releases when launching
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onToggleAutoCheckUpdates}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    autoCheckUpdates ? 'bg-amber-500' : 'bg-slate-300 dark:bg-zinc-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      autoCheckUpdates ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Section: Updates & About */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 px-1">
              Application & Updates
            </span>
            <div className="mt-1.5 flex items-center justify-between bg-slate-50 dark:bg-zinc-800/50 border border-slate-200/80 dark:border-zinc-800 rounded-xl p-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                  <Sparkles size={15} />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium">VibeNotes</span>
                    <span className="font-mono text-[10px] px-1.5 py-0.2 bg-slate-200 dark:bg-zinc-700 rounded text-slate-600 dark:text-zinc-300">
                      v{appVersion}
                    </span>
                    {hasUpdateAvailable && (
                      <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded-full bg-amber-500 text-amber-950">
                        New Update
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                    Fast, lightweight sticky notes with Markdown
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  onClose();
                  onOpenUpdates();
                }}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-amber-500 hover:bg-amber-600 text-amber-950 shadow-xs transition-colors cursor-pointer"
              >
                <Sparkles size={12} />
                <span>Updates</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end pt-1">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
