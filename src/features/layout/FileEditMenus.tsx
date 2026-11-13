import {
  AlignLeft,
  Command,
  Database,
  LayoutGrid,
  Play,
  Plus,
  RefreshCw,
  Settings,
  X,
} from 'lucide-react';
import type React from 'react';
import { SqlQueryIcon } from '../../components/ui/DatabaseIcons';
import { Kbd } from '../../components/ui/Kbd';
import { closeWindow } from '../../services/tauri';
import type { ConnectionSummary } from '../../types/database';

interface FileMenuDropdownProps {
  currentConnection: ConnectionSummary | null;
  hasActiveTabs: boolean;
  hasClosedTabs: boolean;
  sc: (id: string) => string;
  closeMenu: () => void;
  onOpenNewConnectionModal: () => void;
  onNewSqlTab: () => void;
  onReopenClosedTab: () => void;
  onCloseActiveTab: () => void;
  onCloseAllTabs: () => void;
  onOpenSettings: (tab?: string) => void;
  onDisconnect: () => void;
}

export const FileMenuDropdown: React.FC<FileMenuDropdownProps> = ({
  currentConnection,
  hasActiveTabs,
  hasClosedTabs,
  sc,
  closeMenu,
  onOpenNewConnectionModal,
  onNewSqlTab,
  onReopenClosedTab,
  onCloseActiveTab,
  onCloseAllTabs,
  onOpenSettings,
  onDisconnect,
}) => (
  <div className="menubar-dropdown animate-fade-in">
    <button
      type="button"
      className="menubar-dropdown-item"
      onClick={() => {
        closeMenu();
        onOpenNewConnectionModal();
      }}
    >
      <Plus size={13} className="item-icon accent" />
      <span className="item-label">New Connection…</span>
      <Kbd size="xs">{sc('new-connection')}</Kbd>
    </button>
    <button
      type="button"
      className="menubar-dropdown-item"
      onClick={() => {
        closeMenu();
        onNewSqlTab();
      }}
    >
      <SqlQueryIcon size={13} className="item-icon" />
      <span className="item-label">New SQL Query</span>
      <Kbd size="xs">{sc('new-sql-tab')}</Kbd>
    </button>

    <div className="menubar-separator" />

    <button
      type="button"
      className="menubar-dropdown-item"
      disabled={!hasClosedTabs}
      onClick={() => {
        closeMenu();
        onReopenClosedTab();
      }}
    >
      <RefreshCw size={13} className="item-icon" />
      <span className="item-label">Reopen Closed Tab</span>
      <Kbd size="xs">{sc('reopen-closed-tab')}</Kbd>
    </button>
    <button
      type="button"
      className="menubar-dropdown-item"
      disabled={!hasActiveTabs}
      onClick={() => {
        closeMenu();
        onCloseActiveTab();
      }}
    >
      <X size={13} className="item-icon" />
      <span className="item-label">Close Active Tab</span>
      <Kbd size="xs">{sc('close-tab')}</Kbd>
    </button>
    <button
      type="button"
      className="menubar-dropdown-item"
      disabled={!hasActiveTabs}
      onClick={() => {
        closeMenu();
        onCloseAllTabs();
      }}
    >
      <X size={13} className="item-icon" />
      <span className="item-label">Close All Unpinned Tabs</span>
      <Kbd size="xs">{sc('close-all-tabs')}</Kbd>
    </button>

    <div className="menubar-separator" />

    <button
      type="button"
      className="menubar-dropdown-item"
      onClick={() => {
        closeMenu();
        onOpenSettings('appearance');
      }}
    >
      <Settings size={13} className="item-icon" />
      <span className="item-label">Settings…</span>
      <Kbd size="xs">{sc('open-settings')}</Kbd>
    </button>
    {currentConnection && (
      <button
        type="button"
        className="menubar-dropdown-item"
        onClick={() => {
          closeMenu();
          onDisconnect();
        }}
      >
        <Database size={13} className="item-icon danger-icon" />
        <span className="item-label">Disconnect Active</span>
      </button>
    )}
    <div className="menubar-separator" />
    <button
      type="button"
      className="menubar-dropdown-item"
      onClick={() => {
        closeMenu();
        void closeWindow();
      }}
    >
      <X size={13} className="item-icon danger-icon" />
      <span className="item-label">Exit</span>
    </button>
  </div>
);

interface EditMenuDropdownProps {
  isSqlTabActive: boolean;
  sc: (id: string) => string;
  closeMenu: () => void;
  onOpenCommandPalette: () => void;
  onFormatSql?: () => void;
  onExecuteQuery?: () => void;
  onExplainQuery?: () => void;
}

export const EditMenuDropdown: React.FC<EditMenuDropdownProps> = ({
  isSqlTabActive,
  sc,
  closeMenu,
  onOpenCommandPalette,
  onFormatSql,
  onExecuteQuery,
  onExplainQuery,
}) => (
  <div className="menubar-dropdown animate-fade-in">
    <button
      type="button"
      className="menubar-dropdown-item"
      onClick={() => {
        closeMenu();
        onOpenCommandPalette();
      }}
    >
      <Command size={13} className="item-icon accent" />
      <span className="item-label">Command Palette…</span>
      <Kbd size="xs">{sc('command-palette')}</Kbd>
    </button>
    <button
      type="button"
      className="menubar-dropdown-item"
      disabled={!isSqlTabActive}
      onClick={() => {
        closeMenu();
        onFormatSql?.();
      }}
    >
      <AlignLeft size={13} className="item-icon" />
      <span className="item-label">Format SQL</span>
      <Kbd size="xs">{sc('format-sql')}</Kbd>
    </button>
    <button
      type="button"
      className="menubar-dropdown-item"
      disabled={!isSqlTabActive}
      onClick={() => {
        closeMenu();
        onExecuteQuery?.();
      }}
    >
      <Play size={13} className="item-icon accent" />
      <span className="item-label">Execute Query</span>
      <Kbd size="xs">{sc('execute-query')}</Kbd>
    </button>
    <button
      type="button"
      className="menubar-dropdown-item"
      disabled={!isSqlTabActive}
      onClick={() => {
        closeMenu();
        onExplainQuery?.();
      }}
    >
      <LayoutGrid size={13} className="item-icon" />
      <span className="item-label">Explain Query Plan</span>
      <Kbd size="xs">{sc('explain-query')}</Kbd>
    </button>
  </div>
);
