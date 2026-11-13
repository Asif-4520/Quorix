import type React from 'react';
import { ConfirmModal } from '../components/ConfirmModal';
import { ConnectionModal } from '../features/connections/ConnectionModal';
import { CreateTableModal } from '../features/overview/CreateTableModal';
import { CommandPalette, type PaletteScope } from '../features/palette/CommandPalette';
import { SettingsModal } from '../features/settings/SettingsModal';
import { ShortcutsModal } from '../features/shortcuts/ShortcutsModal';
import type {
  ConnectionSummary,
  SavedConnection,
  SavedQuery,
  SchemaInfo,
  SchemaIntrospection,
  TableInfo,
  ThemeMode,
  ThemeName,
} from '../types/database';

interface ConfirmModalState {
  isOpen: boolean;
  title: string;
  message: string;
  sql?: string;
  onConfirm: () => Promise<void> | void;
}

interface AppModalsProps {
  showPalette: boolean;
  paletteScope: PaletteScope;
  showSettings: boolean;
  settingsTab: string;
  showShortcuts: boolean;
  showConnections: boolean;
  showCreateTable: boolean;
  confirmModal: ConfirmModalState;
  currentConnection: ConnectionSummary | null;
  schemasByConn: Record<string, SchemaInfo[]>;
  activeIntrospection: SchemaIntrospection | null;
  isSqlActive: boolean;
  savedQueries: SavedQuery[];
  savedConnections: SavedConnection[];
  activeTabId: string;
  onClosePalette: () => void;
  onCloseSettings: () => void;
  onCloseShortcuts: () => void;
  onCloseConnections: () => void;
  onCloseCreateTable: () => void;
  onCancelConfirm: () => void;
  onOpenConfirm: (title: string, message: string, onConfirm: () => void) => void;
  onOpenConnections: () => void;
  onOpenSettings: (tab?: string) => void;
  onOpenShortcuts: () => void;
  onDisconnect: () => void;
  onNewSqlTab: () => void;
  onOpenTable: (tbl: TableInfo) => void;
  onOpenSchema: (schemaName: string) => void;
  onOpenSavedQuery: (q: SavedQuery) => void;
  onSelectSavedConnection: (sc: SavedConnection) => void;
  onOpenErDiagram: () => void;
  onOpenSchemaDiff: () => void;
  onRefreshSchema: () => void;
  onExecuteQuery: () => void;
  onExecuteAll?: () => void;
  onExplainQuery?: () => void;
  onToggleSidebar: () => void;
  onToggleInspector: () => void;
  onOpenCreateTable: () => void;
  onSetThemeMode: (mode: ThemeMode) => void;
  onSetThemePreset: (preset: ThemeName) => void;
  onReopenClosedTab: () => void;
  onCloseActiveTab: () => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const AppModals: React.FC<AppModalsProps> = ({
  showPalette,
  paletteScope,
  showSettings,
  settingsTab,
  showShortcuts,
  showConnections,
  showCreateTable,
  confirmModal,
  currentConnection,
  schemasByConn,
  activeIntrospection,
  isSqlActive,
  savedQueries,
  savedConnections,
  activeTabId,
  onClosePalette,
  onCloseSettings,
  onCloseShortcuts,
  onCloseConnections,
  onCloseCreateTable,
  onCancelConfirm,
  onOpenConfirm,
  onOpenConnections,
  onOpenSettings,
  onOpenShortcuts,
  onDisconnect,
  onNewSqlTab,
  onOpenTable,
  onOpenSchema,
  onOpenSavedQuery,
  onSelectSavedConnection,
  onOpenErDiagram,
  onOpenSchemaDiff,
  onRefreshSchema,
  onExecuteQuery,
  onExecuteAll,
  onExplainQuery,
  onToggleSidebar,
  onToggleInspector,
  onOpenCreateTable,
  onSetThemeMode,
  onSetThemePreset,
  onReopenClosedTab,
  onCloseActiveTab,
  onShowToast,
}) => (
  <>
    {showPalette && (
      <CommandPalette
        isOpen={showPalette}
        onClose={onClosePalette}
        isConnected={Boolean(currentConnection)}
        isSqlActive={isSqlActive}
        schema={activeIntrospection}
        savedQueries={savedQueries}
        savedConnections={savedConnections}
        initialScope={paletteScope}
        onOpenConnections={onOpenConnections}
        onDisconnect={onDisconnect}
        onNewSqlTab={onNewSqlTab}
        onOpenTable={onOpenTable}
        onOpenSchema={onOpenSchema}
        onOpenSavedQuery={onOpenSavedQuery}
        onSelectSavedConnection={onSelectSavedConnection}
        onOpenErDiagram={onOpenErDiagram}
        onOpenSchemaDiff={onOpenSchemaDiff}
        onRefreshSchema={onRefreshSchema}
        onExecuteQuery={onExecuteQuery}
        onExecuteAll={onExecuteAll}
        onExplainQuery={onExplainQuery}
        onToggleSidebar={onToggleSidebar}
        onToggleInspector={onToggleInspector}
        onOpenCreateTable={onOpenCreateTable}
        onOpenSettings={onOpenSettings}
        onOpenShortcuts={onOpenShortcuts}
        onSetThemeMode={onSetThemeMode}
        onSetThemePreset={onSetThemePreset}
        onReopenClosedTab={onReopenClosedTab}
        onCloseActiveTab={() => {
          if (activeTabId) onCloseActiveTab();
        }}
      />
    )}

    {showSettings && (
      <SettingsModal
        isOpen={showSettings}
        initialTab={settingsTab}
        onClose={onCloseSettings}
        onOpenShortcuts={() => {
          onCloseSettings();
          onOpenShortcuts();
        }}
        onRequestConfirm={onOpenConfirm}
      />
    )}

    {showShortcuts && (
      <ShortcutsModal
        isOpen={showShortcuts}
        onClose={onCloseShortcuts}
        onRequestConfirm={onOpenConfirm}
      />
    )}

    {showConnections && (
      <ConnectionModal
        isOpen={showConnections}
        onClose={onCloseConnections}
        onShowToast={onShowToast}
      />
    )}

    {currentConnection && showCreateTable && (
      <CreateTableModal
        isOpen={showCreateTable}
        connection={currentConnection}
        schemas={schemasByConn[currentConnection.id] || []}
        onClose={onCloseCreateTable}
        onTableCreated={onRefreshSchema}
        onShowToast={onShowToast}
      />
    )}

    <ConfirmModal
      isOpen={confirmModal.isOpen}
      title={confirmModal.title}
      message={confirmModal.message}
      sql={confirmModal.sql}
      onConfirm={confirmModal.onConfirm}
      onCancel={onCancelConfirm}
    />
  </>
);
