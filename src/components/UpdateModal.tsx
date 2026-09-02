import React, { useState, useEffect } from 'react';
import { check, Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { getVersion } from '@tauri-apps/api/app';
import {
  Sparkles,
  Download,
  RotateCw,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  X,
  Loader2,
} from 'lucide-react';

interface UpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  autoCheck?: boolean;
}

type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'up-to-date'
  | 'downloading'
  | 'ready-to-restart'
  | 'error';

export const UpdateModal: React.FC<UpdateModalProps> = ({
  isOpen,
  onClose,
  autoCheck = false,
}) => {
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [currentVersion, setCurrentVersion] = useState<string>('');
  const [updateInfo, setUpdateInfo] = useState<Update | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [downloadedBytes, setDownloadedBytes] = useState<number>(0);
  const [totalBytes, setTotalBytes] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const fetchCurrentVersion = async () => {
    try {
      const ver = await getVersion();
      setCurrentVersion(ver);
    } catch {
      setCurrentVersion('0.3.3');
    }
  };

  const handleCheckForUpdates = async () => {
    setStatus('checking');
    setErrorMessage('');
    setDownloadProgress(0);

    try {
      const update = await check();
      if (update?.available) {
        setUpdateInfo(update);
        setStatus('available');
      } else {
        setUpdateInfo(null);
        setStatus('up-to-date');
      }
    } catch (err: any) {
      console.error('Failed to check for updates:', err);
      setErrorMessage(
        err?.message || 'Could not connect to update server. Please check your internet connection.'
      );
      setStatus('error');
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchCurrentVersion();
      if (autoCheck || status === 'idle') {
        handleCheckForUpdates();
      }
    }
  }, [isOpen]);

  const handleDownloadAndInstall = async () => {
    if (!updateInfo) return;

    setStatus('downloading');
    setDownloadProgress(0);
    setDownloadedBytes(0);
    setTotalBytes(0);

    let downloaded = 0;
    let total = 0;

    try {
      await updateInfo.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          total = event.data.contentLength || 0;
          setTotalBytes(total);
        } else if (event.event === 'Progress') {
          downloaded += event.data.chunkLength;
          setDownloadedBytes(downloaded);
          if (total > 0) {
            setDownloadProgress(Math.min(100, Math.round((downloaded / total) * 100)));
          }
        } else if (event.event === 'Finished') {
          setStatus('ready-to-restart');
        }
      });
      setStatus('ready-to-restart');
    } catch (err: any) {
      console.error('Failed to download update:', err);
      setErrorMessage(
        err?.message || 'Failed to download and install update. Please try manual download.'
      );
      setStatus('error');
    }
  };

  const handleRelaunch = async () => {
    try {
      await relaunch();
    } catch (err) {
      console.error('Failed to restart app:', err);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 select-none">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 w-full max-w-md p-5 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150 text-slate-800 dark:text-zinc-100">
        {/* Modal Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Sparkles size={18} />
            </div>
            <div>
              <h3 className="font-semibold text-sm">VibeNotes Updates</h3>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                Current Version: <span className="font-mono font-medium">v{currentVersion || '0.3.3'}</span>
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

        {/* Modal Body depending on Status */}
        <div className="min-h-[140px] flex flex-col justify-center">
          {/* Checking Status */}
          {status === 'checking' && (
            <div className="flex flex-col items-center justify-center py-6 text-center gap-2.5">
              <Loader2 size={28} className="animate-spin text-amber-500" />
              <p className="text-xs font-medium text-slate-600 dark:text-zinc-300">
                Checking for releases on GitHub...
              </p>
            </div>
          )}

          {/* Up-to-date Status */}
          {status === 'up-to-date' && (
            <div className="flex flex-col items-center justify-center py-4 text-center gap-2">
              <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500 flex items-center justify-center mb-1">
                <CheckCircle2 size={24} />
              </div>
              <h4 className="font-semibold text-sm">You are on the latest version</h4>
              <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-xs">
                VibeNotes v{currentVersion} is currently the newest available release.
              </p>
            </div>
          )}

          {/* Update Available Status */}
          {status === 'available' && updateInfo && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl p-3">
                <div className="flex flex-col">
                  <span className="text-[11px] font-medium text-amber-800 dark:text-amber-300">
                    New Version Available
                  </span>
                  <span className="font-bold text-base text-amber-950 dark:text-amber-100">
                    v{updateInfo.version}
                  </span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-200/80 dark:bg-amber-900/60 font-semibold text-amber-900 dark:text-amber-200">
                  Release
                </span>
              </div>

              {/* Release Notes */}
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">
                  Release Notes:
                </span>
                <div className="bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 max-h-36 overflow-y-auto text-xs text-slate-700 dark:text-zinc-300 font-mono whitespace-pre-wrap leading-relaxed">
                  {updateInfo.body || 'Performance improvements and bug fixes.'}
                </div>
              </div>
            </div>
          )}

          {/* Downloading Progress Status */}
          {status === 'downloading' && (
            <div className="flex flex-col gap-3 py-2">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="flex items-center gap-1.5 text-slate-700 dark:text-zinc-300">
                  <Download size={14} className="animate-bounce text-amber-500" />
                  Downloading update package...
                </span>
                <span className="font-mono text-amber-600 dark:text-amber-400">
                  {downloadProgress}%
                </span>
              </div>

              {/* Progress Track */}
              <div className="w-full bg-slate-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-amber-500 h-full transition-all duration-200 rounded-full"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-zinc-500">
                <span>{formatBytes(downloadedBytes)} downloaded</span>
                {totalBytes > 0 && <span>Total: {formatBytes(totalBytes)}</span>}
              </div>
            </div>
          )}

          {/* Ready to Restart Status */}
          {status === 'ready-to-restart' && (
            <div className="flex flex-col items-center justify-center py-4 text-center gap-2">
              <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500 flex items-center justify-center mb-1">
                <RotateCw size={24} />
              </div>
              <h4 className="font-semibold text-sm">Update Ready to Install</h4>
              <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-xs">
                The new version has been downloaded. Restart VibeNotes to complete the update.
              </p>
            </div>
          )}

          {/* Error Status */}
          {status === 'error' && (
            <div className="flex flex-col gap-2.5 py-2">
              <div className="flex items-start gap-2.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl p-3 text-red-700 dark:text-red-300 text-xs">
                <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-500" />
                <div className="flex flex-col gap-1">
                  <span className="font-semibold">Update check failed</span>
                  <p className="opacity-90 leading-relaxed text-[11px]">{errorMessage}</p>
                </div>
              </div>

              <a
                href="https://github.com/vahabahmadvand/VibeNotes/releases"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline pt-1"
              >
                <span>View releases manually on GitHub</span>
                <ExternalLink size={12} />
              </a>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-zinc-800">
          <a
            href="https://github.com/vahabahmadvand/VibeNotes/releases"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300 transition-colors"
          >
            <span>GitHub Releases</span>
            <ExternalLink size={11} />
          </a>

          <div className="flex items-center gap-2">
            {status === 'available' && (
              <>
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  Later
                </button>
                <button
                  onClick={handleDownloadAndInstall}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-amber-950 shadow-sm transition-colors cursor-pointer"
                >
                  <Download size={13} />
                  <span>Update Now</span>
                </button>
              </>
            )}

            {status === 'ready-to-restart' && (
              <button
                onClick={handleRelaunch}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors cursor-pointer"
              >
                <RotateCw size={13} />
                <span>Restart VibeNotes</span>
              </button>
            )}

            {(status === 'up-to-date' || status === 'error') && (
              <button
                onClick={handleCheckForUpdates}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <RotateCw size={12} />
                <span>Check Again</span>
              </button>
            )}

            {status === 'checking' && (
              <button
                disabled
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 opacity-60 cursor-not-allowed"
              >
                Checking...
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
