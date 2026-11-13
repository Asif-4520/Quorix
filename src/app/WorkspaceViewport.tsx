import type React from 'react';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { DataViewer } from '../features/dataviewer/DataViewer';
import { ErDiagram } from '../features/diagram/ErDiagram';
import { InspectorPanel } from '../features/inspector/InspectorPanel';
import { WorkspaceTabsBar } from '../features/layout/WorkspaceTabsBar';
import { DatabaseOverview } from '../features/overview/DatabaseOverview';
import { SchemaDiffTool } from '../features/overview/SchemaDiffTool';
import { SqlEditor, type SqlEditorHandle } from '../features/sqleditor/SqlEditor';
import type {
  ConnectionSummary,
  FilterRule,
  InspectorTarget,
  TabItem,
  TableInfo,
  TableSubTab,
} from '../types/database';

interface WorkspaceViewportProps {
  tabs: TabItem[];
  activeTabId: string;
  activeTab: TabItem | undefined;
  currentConnection: ConnectionSummary | null;
  tabConnection: ConnectionSummary | null;
  activeConnectionId: string | null;
  hasClosedTabs: boolean;
  isRefreshingSchema: boolean;
  inspectorOpen: boolean;
  inspectorWidth: number;
  inspectorTarget: InspectorTarget | null;
  activeEditorRef: React.MutableRefObject<SqlEditorHandle | null>;
  onSelectTab: (id: string) => void;
  onSwitchActiveConnection: (connId: string) => void;
  onCloseTab: (id: string) => void;
  onCloseOtherTabs: (id: string) => void;
  onCloseAllTabs: () => void;
  onReopenClosedTab: () => void;
  onTogglePinTab: (id: string) => void;
  onNewSqlTab: () => void;
  onRefreshSchema: () => void;
  onOpenErDiagram: () => void;
  onOpenCommandPalette: () => void;
  onToggleInspector: () => void;
  onCloseInspector: () => void;
  onResizeInspectorWidth: (w: number) => void;
  onOpenConnections: () => void;
  onOpenCreateTable: () => void;
  onUpdateTab: (tabId: string, patch: { sqlContent?: string; isDirty?: boolean }) => void;
  onOpenTableTab: (
    table: TableInfo,
    connId: string,
    connName: string,
    subTab?: TableSubTab,
    initialFilters?: FilterRule[],
  ) => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onRequestConfirm: (
    title: string,
    message: string,
    sql: string | undefined,
    onConfirm: () => Promise<void> | void,
  ) => void;
}

export const WorkspaceViewport: React.FC<WorkspaceViewportProps> = ({
  tabs,
  activeTabId,
  activeTab,
  currentConnection,
  tabConnection,
  activeConnectionId,
  hasClosedTabs,
  isRefreshingSchema,
  inspectorOpen,
  inspectorWidth,
  inspectorTarget,
  activeEditorRef,
  onSelectTab,
  onSwitchActiveConnection,
  onCloseTab,
  onCloseOtherTabs,
  onCloseAllTabs,
  onReopenClosedTab,
  onTogglePinTab,
  onNewSqlTab,
  onRefreshSchema,
  onOpenErDiagram,
  onOpenCommandPalette,
  onToggleInspector,
  onCloseInspector,
  onResizeInspectorWidth,
  onOpenConnections,
  onOpenCreateTable,
  onUpdateTab,
  onOpenTableTab,
  onShowToast,
  onRequestConfirm,
}) => (
  <main data-workspace-root="true" tabIndex={-1} className="quorix-content-viewport outline-none">
    <WorkspaceTabsBar
      tabs={tabs}
      activeTabId={activeTabId}
      onSelectTab={(id) => {
        onSelectTab(id);
        const tab = tabs.find((t) => t.id === id);
        if (tab?.connectionId && tab.connectionId !== activeConnectionId) {
          onSwitchActiveConnection(tab.connectionId);
        }
      }}
      onCloseTab={onCloseTab}
      onCloseOtherTabs={onCloseOtherTabs}
      onCloseAllTabs={onCloseAllTabs}
      onReopenClosedTab={onReopenClosedTab}
      onTogglePinTab={onTogglePinTab}
      onNewSqlTab={onNewSqlTab}
      hasClosedTabs={hasClosedTabs}
      isConnected={Boolean(currentConnection)}
      isRefreshing={isRefreshingSchema}
      onRefreshSchema={onRefreshSchema}
      onOpenErDiagram={onOpenErDiagram}
      onOpenCommandPalette={onOpenCommandPalette}
      inspectorOpen={inspectorOpen}
      onToggleInspector={onToggleInspector}
    />

    <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden">
      <ErrorBoundary fallbackTitle="Workspace Error">
        {!activeTab ? (
          <DatabaseOverview
            onOpenConnections={onOpenConnections}
            onOpenCreateTable={onOpenCreateTable}
          />
        ) : activeTab.type === 'database-info' ? (
          <DatabaseOverview
            connectionId={activeTab.connectionId}
            onOpenConnections={onOpenConnections}
            onOpenCreateTable={onOpenCreateTable}
          />
        ) : activeTab.type === 'schema-info' ? (
          <DatabaseOverview
            connectionId={activeTab.connectionId}
            schemaFilter={activeTab.schema}
            onOpenConnections={onOpenConnections}
            onOpenCreateTable={onOpenCreateTable}
          />
        ) : activeTab.type === 'table' && tabConnection ? (
          <DataViewer
            key={activeTab.id}
            tabId={activeTab.id}
            table={{
              name: activeTab.tableName || '',
              schema: activeTab.schema,
              kind: activeTab.tableKind || 'table',
              hasPrimaryKey: true,
              isStrict: false,
              withoutRowid: false,
            }}
            activeSubTab={activeTab.activeSubTab || 'data'}
            initialFilters={activeTab.initialFilters}
            currentConnection={tabConnection}
            onShowToast={onShowToast}
            onRequestConfirm={onRequestConfirm}
            onNavigateToTable={(tblName, schemaName, initialFilters) =>
              onOpenTableTab(
                {
                  name: tblName,
                  schema: schemaName,
                  kind: 'table',
                  hasPrimaryKey: true,
                  isStrict: false,
                  withoutRowid: false,
                },
                tabConnection.id,
                tabConnection.name,
                'data',
                initialFilters,
              )
            }
          />
        ) : activeTab.type === 'er-diagram' && tabConnection ? (
          <ErDiagram
            key={activeTab.id}
            connectionId={tabConnection.id}
            initialSchema={activeTab.schema}
            onSelectTable={(tbl) => onOpenTableTab(tbl, tabConnection.id, tabConnection.name)}
            onShowToast={onShowToast}
          />
        ) : activeTab.type === 'schema-diff' ? (
          <SchemaDiffTool
            key={activeTab.id}
            initialSourceConnId={activeTab.sourceConnectionId || tabConnection?.id}
            initialTargetConnId={activeTab.targetConnectionId}
            onShowToast={onShowToast}
          />
        ) : (
          <SqlEditor
            key={activeTab.id}
            tabId={activeTab.id}
            initialSql={activeTab.sqlContent || ''}
            savedQueryId={activeTab.savedQueryId}
            currentConnection={tabConnection}
            onSqlChange={(sql) => onUpdateTab(activeTab.id, { sqlContent: sql, isDirty: true })}
            onShowToast={onShowToast}
            onRequestConfirm={onRequestConfirm}
            editorRef={activeEditorRef}
          />
        )}
      </ErrorBoundary>

      {inspectorOpen && (
        <InspectorPanel
          target={inspectorTarget}
          width={inspectorWidth}
          onResizeWidth={onResizeInspectorWidth}
          onClose={onCloseInspector}
          onShowToast={onShowToast}
        />
      )}
    </div>
  </main>
);
