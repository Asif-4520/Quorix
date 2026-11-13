import { ArrowUpRight } from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { Toaster } from 'sonner';
import { ConfirmModal } from '../components/ConfirmModal';
import { QuorixLogo } from '../components/ui/QuorixLogo';
import { TooltipHost } from '../components/ui/TooltipHost';
import {
  closeWindow,
  isWindowMaximized,
  minimizeWindow,
  subscribeCrossWindowSettingsUpdated,
  subscribeCrossWindowShortcutsUpdated,
  subscribeWindowResized,
  toggleMaximizeWindow,
} from '../services/tauri';
import { useSettingsStore } from '../stores/settingsStore';
import { THEMES } from '../theme/themes';

export type ConfirmRequestHandler = (title: string, message: string, onConfirm: () => void) => void;

interface StudioWindowFrameProps {
  windowTitle: string;
  headerTitle: string;
  studioBadge: string;
  icon: React.ReactNode;
  siblingAction?: {
    label: string;
    ariaLabel: string;
    title: string;
    icon: React.ReactNode;
    onClick: () => void;
  };
  children: (helpers: {
    onClose: () => void;
    onRequestConfirm: ConfirmRequestHandler;
  }) => React.ReactNode;
}

export const StudioWindowFrame: React.FC<StudioWindowFrameProps> = ({
  windowTitle,
  headerTitle,
  studioBadge,
  icon,
  siblingAction,
  children,
}) => {
  const effectiveTheme = useSettingsStore((s) => s.effectiveTheme);
  const syncFromStorage = useSettingsStore((s) => s.syncFromStorage);
  const [isMaximized, setIsMaximized] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => Promise<void> | void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const themeColors = THEMES[effectiveTheme] || THEMES['obsidian-dark'];

  useEffect(() => {
    document.title = windowTitle;
    syncFromStorage();
  }, [windowTitle, syncFromStorage]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key.includes('settings')) {
        syncFromStorage();
      }
      if (!e.key || e.key.includes('keybindings')) {
        window.dispatchEvent(new Event('quorix-shortcuts-updated'));
      }
    };
    const onFocus = () => {
      syncFromStorage();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onFocus);

    let active = true;
    let unlistenShortcuts: (() => void) | null = null;
    let unlistenSettings: (() => void) | null = null;

    void subscribeCrossWindowShortcutsUpdated(() => {
      window.dispatchEvent(new Event('quorix-shortcuts-updated'));
    }).then((fn) => {
      if (active) unlistenShortcuts = fn;
      else fn?.();
    });

    void subscribeCrossWindowSettingsUpdated(() => {
      syncFromStorage();
    }).then((fn) => {
      if (active) unlistenSettings = fn;
      else fn?.();
    });

    return () => {
      active = false;
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onFocus);
      unlistenShortcuts?.();
      unlistenSettings?.();
    };
  }, [syncFromStorage]);

  useEffect(() => {
    let active = true;
    let unlistenResize: (() => void) | undefined;
    const syncWin = () => {
      void isWindowMaximized().then((max) => {
        if (active) setIsMaximized(max);
      });
    };
    syncWin();
    void subscribeWindowResized(syncWin).then((fn) => {
      if (active) unlistenResize = fn;
      else fn();
    });
    return () => {
      active = false;
      unlistenResize?.();
    };
  }, []);

  const handleCloseWindow = useCallback(() => {
    void closeWindow();
  }, []);

  const handleRequestConfirm = useCallback<ConfirmRequestHandler>((title, message, onConfirm) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm,
    });
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-[var(--bg)] text-[var(--text)] overflow-hidden select-none">
      <header className="titlebar-shell shrink-0">
        <div className="titlebar-window-row">
          <div className="titlebar-window-left min-w-0" data-tauri-drag-region>
            <div className="flex items-center gap-2 pl-1.5 min-w-0" data-tauri-drag-region>
              <QuorixLogo variant="mark" className="brand-logo-img" />
              <span className="text-[12px] font-semibold tracking-tight text-[var(--text)]">
                Quorix
              </span>
              <span className="text-[var(--text-muted)] text-[11px]">/</span>
              <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-[var(--text-secondary)]">
                {icon}
                {headerTitle}
              </span>
              <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border)] text-[9.5px] font-mono text-[var(--text-muted)]">
                {studioBadge}
              </span>
            </div>
          </div>

          <div className="titlebar-drag-spacer" data-tauri-drag-region />

          <div className="titlebar-window-right">
            {siblingAction && (
              <button
                type="button"
                aria-label={siblingAction.ariaLabel}
                title={siblingAction.title}
                onClick={siblingAction.onClick}
                className="relative mr-1.5 pl-2 pr-5 py-1 rounded border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] hover:border-[var(--border-focus)] text-[10.5px] font-medium text-[var(--text-secondary)] hover:text-[var(--text)] inline-flex items-center gap-1.5 transition-colors"
              >
                {siblingAction.icon}
                <span>{siblingAction.label}</span>
                <ArrowUpRight
                  size={10}
                  aria-hidden="true"
                  className="absolute top-1 right-1 text-[var(--accent)]"
                />
              </button>
            )}

            <div className="window-controls" role="group" aria-label="Window controls">
              <button
                type="button"
                className="window-control-btn"
                aria-label="Minimize"
                title="Minimize"
                onClick={() => void minimizeWindow()}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                  <line x1="0" y1="5" x2="10" y2="5" stroke="currentColor" strokeWidth="1" />
                </svg>
              </button>
              <button
                type="button"
                className="window-control-btn"
                aria-label={isMaximized ? 'Restore' : 'Maximize'}
                title={isMaximized ? 'Restore Window' : 'Maximize Window'}
                onClick={() => void toggleMaximizeWindow()}
              >
                {isMaximized ? (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                    <path d="M2.5 2.5V0.5H9.5V7.5H7.5" stroke="currentColor" strokeWidth="1" />
                    <rect
                      x="0.5"
                      y="2.5"
                      width="7"
                      height="7"
                      stroke="currentColor"
                      strokeWidth="1"
                    />
                  </svg>
                ) : (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                    <rect
                      x="0.5"
                      y="0.5"
                      width="9"
                      height="9"
                      stroke="currentColor"
                      strokeWidth="1"
                    />
                  </svg>
                )}
              </button>
              <button
                type="button"
                className="window-control-btn close"
                aria-label="Close"
                title="Close Window"
                onClick={handleCloseWindow}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                  <line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" strokeWidth="1.1" />
                  <line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" strokeWidth="1.1" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 min-h-0 flex flex-col">
        {children({
          onClose: handleCloseWindow,
          onRequestConfirm: handleRequestConfirm,
        })}
      </main>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />

      <Toaster
        position="bottom-right"
        theme={themeColors.isDark ? 'dark' : 'light'}
        toastOptions={{
          style: {
            background: 'var(--bg-panel)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            fontSize: '12px',
          },
        }}
      />
      <TooltipHost />
    </div>
  );
};
