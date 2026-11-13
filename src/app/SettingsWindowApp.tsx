import { Sliders } from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { SettingsModal } from '../features/settings/SettingsModal';
import {
  emitCrossWindowClearHistory,
  getStudioInitialTab,
  openShortcutsDesktopWindow,
  subscribeCrossWindowSettingsNavigate,
} from '../services/tauri';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { StudioWindowFrame } from './StudioWindowFrame';

export const SettingsWindowApp: React.FC = () => {
  const [activeInitialTab, setActiveInitialTab] = useState<string>(
    () => getStudioInitialTab() || 'appearance',
  );

  useEffect(() => {
    let active = true;
    let unlistenNav: (() => void) | null = null;
    void subscribeCrossWindowSettingsNavigate((tab) => {
      if (active && tab) {
        setActiveInitialTab(tab);
      }
    }).then((fn) => {
      if (active) unlistenNav = fn;
      else fn?.();
    });
    return () => {
      active = false;
      unlistenNav?.();
    };
  }, []);

  const handleOpenShortcuts = useCallback(() => {
    void openShortcutsDesktopWindow();
  }, []);

  const handleClearHistory = useCallback(() => {
    useWorkspaceStore.getState().clearHistory();
    void emitCrossWindowClearHistory();
  }, []);

  return (
    <StudioWindowFrame
      windowTitle="Settings — Quorix"
      headerTitle="Settings"
      studioBadge="Preferences Studio"
      icon={<Sliders size={12} className="text-[var(--accent)]" />}
    >
      {({ onClose, onRequestConfirm }) => (
        <SettingsModal
          isOpen={true}
          standaloneWindow={true}
          initialTab={activeInitialTab}
          onClose={onClose}
          onOpenShortcuts={handleOpenShortcuts}
          onClearHistory={handleClearHistory}
          onRequestConfirm={onRequestConfirm}
        />
      )}
    </StudioWindowFrame>
  );
};
