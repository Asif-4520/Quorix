import {
  Activity,
  Check,
  Copy,
  Edit2,
  Eye,
  GitCompareArrows,
  Layers,
  RefreshCw,
  Table,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import type React from 'react';
import { ErDiagramIcon, RelationsIcon, SqlQueryIcon } from '../../components/ui/DatabaseIcons';
import type {
  ConnectionSummary,
  InspectorTarget,
  TableInfo,
  TableSubTab,
} from '../../types/database';
import type { ContextMenuState } from './explorerTypes';

interface ExplorerContextMenuProps {
  contextMenu: ContextMenuState;
  copiedId: string | null;
  onClose: () => void;
  onCopyText: (id: string, text: string) => void;
  onOpenDatabaseInfoTab: (connId: string, connName: string) => void;
  onOpenSqlTab: (opts: { title?: string; sql?: string; connectionId?: string }) => void;
  onOpenErDiagramTab: (connId: string, schema?: string) => void;
  onOpenSchemaDiffTab: (connId: string) => void;
  onRefreshConnectionTree: (connId: string) => void;
  onDisconnect: (connId: string) => Promise<void>;
  onCloseTabsForConnection: (connId: string) => void;
  onOpenSchemaInfoTab: (connId: string, schema: string) => void;
  onLoadSchemaObjects: (connId: string, schema: string, forceRefresh?: boolean) => void;
  onOpenTable: (conn: ConnectionSummary, table: TableInfo, subTab?: TableSubTab) => void;
  onRequestTruncateTable: (connId: string, tableName: string, schema?: string) => void;
  onRequestDropTable: (connId: string, tableName: string, schema?: string) => void;
  onSetInspectorTarget: (target: InspectorTarget, openPanel?: boolean) => void;
  onStartRenameQuery: (id: string, title: string) => void;
  onRemoveSavedQuery: (id: string) => void;
}

export const ExplorerContextMenu: React.FC<ExplorerContextMenuProps> = ({
  contextMenu,
  copiedId,
  onClose,
  onCopyText,
  onOpenDatabaseInfoTab,
  onOpenSqlTab,
  onOpenErDiagramTab,
  onOpenSchemaDiffTab,
  onRefreshConnectionTree,
  onDisconnect,
  onCloseTabsForConnection,
  onOpenSchemaInfoTab,
  onLoadSchemaObjects,
  onOpenTable,
  onRequestTruncateTable,
  onRequestDropTable,
  onSetInspectorTarget,
  onStartRenameQuery,
  onRemoveSavedQuery,
}) => {
  const clampedLeft = Math.max(8, Math.min(contextMenu.x, window.innerWidth - 210));
  const clampedTop = Math.max(8, Math.min(contextMenu.y, window.innerHeight - 260));

  return (
    <div
      className="fixed z-50 min-w-[195px] bg-[var(--bg-panel)] border border-[var(--border)] rounded-lg shadow-xl p-1 text-xs animate-fade-in"
      style={{ left: clampedLeft, top: clampedTop }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {contextMenu.kind === 'connection' && (
        <>
          <button
            type="button"
            className="menubar-dropdown-item"
            onClick={() => {
              onOpenDatabaseInfoTab(contextMenu.conn.id, contextMenu.conn.name);
              onClose();
            }}
          >
            <Activity size={12} /> <span>Database Overview</span>
          </button>
          <button
            type="button"
            className="menubar-dropdown-item"
            onClick={() => {
              onOpenSqlTab({ connectionId: contextMenu.conn.id });
              onClose();
            }}
          >
            <SqlQueryIcon size={12} /> <span>New SQL Query</span>
          </button>
          <button
            type="button"
            className="menubar-dropdown-item"
            onClick={() => {
              onOpenErDiagramTab(contextMenu.conn.id);
              onClose();
            }}
          >
            <ErDiagramIcon size={12} /> <span>Open ER Diagram</span>
          </button>
          <button
            type="button"
            className="menubar-dropdown-item"
            onClick={() => {
              onOpenSchemaDiffTab(contextMenu.conn.id);
              onClose();
            }}
          >
            <GitCompareArrows size={12} /> <span>Compare Schema &amp; Diff…</span>
          </button>
          {contextMenu.conn.engineKind === 'sqlite' && (
            <button
              type="button"
              className="menubar-dropdown-item"
              onClick={() => {
                onOpenDatabaseInfoTab(contextMenu.conn.id, contextMenu.conn.name);
                onClose();
              }}
            >
              <Wrench size={12} /> <span>SQLite Maintenance &amp; PRAGMA</span>
            </button>
          )}
          <button
            type="button"
            className="menubar-dropdown-item"
            onClick={() => {
              onRefreshConnectionTree(contextMenu.conn.id);
              onClose();
            }}
          >
            <RefreshCw size={12} /> <span>Refresh</span>
          </button>
          <div className="menubar-separator" />
          <button
            type="button"
            className="menubar-dropdown-item text-[var(--error)]"
            onClick={async () => {
              await onDisconnect(contextMenu.conn.id);
              onCloseTabsForConnection(contextMenu.conn.id);
              onClose();
            }}
          >
            <X size={12} /> <span>Disconnect</span>
          </button>
        </>
      )}

      {contextMenu.kind === 'schema' && (
        <>
          <button
            type="button"
            className="menubar-dropdown-item"
            onClick={() => {
              onOpenSchemaInfoTab(contextMenu.connId, contextMenu.schema);
              onClose();
            }}
          >
            <Layers size={12} /> <span>Explore Schema</span>
          </button>
          <button
            type="button"
            className="menubar-dropdown-item"
            onClick={() => {
              onOpenSqlTab({
                connectionId: contextMenu.connId,
                sql: `-- Schema: ${contextMenu.schema}\nSET search_path TO "${contextMenu.schema}";\n`,
              });
              onClose();
            }}
          >
            <SqlQueryIcon size={12} /> <span>New SQL Query</span>
          </button>
          <button
            type="button"
            className="menubar-dropdown-item"
            onClick={() => {
              onOpenErDiagramTab(contextMenu.connId, contextMenu.schema);
              onClose();
            }}
          >
            <ErDiagramIcon size={12} /> <span>View Schema Diagram</span>
          </button>
          <button
            type="button"
            className="menubar-dropdown-item"
            onClick={() => {
              onLoadSchemaObjects(contextMenu.connId, contextMenu.schema, true);
              onClose();
            }}
          >
            <RefreshCw size={12} /> <span>Refresh Schema</span>
          </button>
        </>
      )}

      {contextMenu.kind === 'table' && (
        <>
          <button
            type="button"
            className="menubar-dropdown-item"
            onClick={() => {
              onOpenTable(contextMenu.conn, contextMenu.table, 'data');
              onClose();
            }}
          >
            <Table size={12} /> <span>View Data</span>
          </button>
          <button
            type="button"
            className="menubar-dropdown-item"
            onClick={() => {
              onOpenTable(contextMenu.conn, contextMenu.table, 'structure');
              onClose();
            }}
          >
            <Layers size={12} /> <span>View Structure</span>
          </button>
          <button
            type="button"
            className="menubar-dropdown-item"
            onClick={() => {
              onOpenTable(contextMenu.conn, contextMenu.table, 'relations');
              onClose();
            }}
          >
            <RelationsIcon size={12} /> <span>View Relationships</span>
          </button>
          <button
            type="button"
            className="menubar-dropdown-item"
            onClick={() => {
              const qChar = contextMenu.conn.engineKind === 'mysql' ? '`' : '"';
              const qualified = contextMenu.table.schema
                ? `${qChar}${contextMenu.table.schema}${qChar}.${qChar}${contextMenu.table.name}${qChar}`
                : `${qChar}${contextMenu.table.name}${qChar}`;
              onOpenSqlTab({
                title: `SELECT ${contextMenu.table.name}`,
                connectionId: contextMenu.conn.id,
                sql: `SELECT *\nFROM ${qualified}\nLIMIT 100;\n`,
              });
              onClose();
            }}
          >
            <SqlQueryIcon size={12} /> <span>Generate SELECT SQL</span>
          </button>
          <div className="menubar-separator" />
          <button
            type="button"
            className="menubar-dropdown-item"
            onClick={() => {
              onCopyText('tbl-name', contextMenu.table.name);
              onClose();
            }}
          >
            {copiedId === 'tbl-name' ? <Check size={12} /> : <Copy size={12} />}
            <span>Copy Name</span>
          </button>
          <button
            type="button"
            className="menubar-dropdown-item"
            onClick={() => {
              const qual = contextMenu.table.schema
                ? `${contextMenu.table.schema}.${contextMenu.table.name}`
                : contextMenu.table.name;
              onCopyText('tbl-qual', qual);
              onClose();
            }}
          >
            <Copy size={12} /> <span>Copy Qualified Name</span>
          </button>
          {!contextMenu.conn.readOnly && contextMenu.table.kind === 'table' && (
            <>
              <div className="menubar-separator" />
              <button
                type="button"
                className="menubar-dropdown-item text-[var(--warning)]"
                onClick={() => {
                  onRequestTruncateTable(
                    contextMenu.conn.id,
                    contextMenu.table.name,
                    contextMenu.table.schema,
                  );
                  onClose();
                }}
              >
                <Trash2 size={12} /> <span>Truncate Table…</span>
              </button>
              <button
                type="button"
                className="menubar-dropdown-item text-[var(--error)]"
                onClick={() => {
                  onRequestDropTable(
                    contextMenu.conn.id,
                    contextMenu.table.name,
                    contextMenu.table.schema,
                  );
                  onClose();
                }}
              >
                <Trash2 size={12} /> <span>Drop Table…</span>
              </button>
            </>
          )}
        </>
      )}

      {contextMenu.kind === 'column' && (
        <>
          <button
            type="button"
            className="menubar-dropdown-item"
            onClick={() => {
              onCopyText('col-name', contextMenu.column.name);
              onClose();
            }}
          >
            <Copy size={12} /> <span>Copy Column Name</span>
          </button>
          <button
            type="button"
            className="menubar-dropdown-item"
            onClick={() => {
              const qn = contextMenu.schema
                ? `${contextMenu.schema}.${contextMenu.tableName}.${contextMenu.column.name}`
                : `${contextMenu.tableName}.${contextMenu.column.name}`;
              onCopyText('col-qual', qn);
              onClose();
            }}
          >
            <Copy size={12} /> <span>Copy Qualified Name</span>
          </button>
          <button
            type="button"
            className="menubar-dropdown-item"
            onClick={() => {
              onSetInspectorTarget(
                {
                  kind: 'object',
                  objectType: 'column',
                  title: `${contextMenu.tableName}.${contextMenu.column.name}`,
                  subtitle: contextMenu.schema,
                  details: {
                    Type: contextMenu.column.dataType,
                    Nullable: contextMenu.column.nullable ? 'YES' : 'NO',
                    PrimaryKey: contextMenu.column.primaryKey ? 'YES' : 'NO',
                    Default: contextMenu.column.defaultValue,
                    Comment: contextMenu.column.comment,
                  },
                },
                true,
              );
              onClose();
            }}
          >
            <Eye size={12} /> <span>Inspect Details</span>
          </button>
        </>
      )}

      {contextMenu.kind === 'query' && (
        <>
          <button
            type="button"
            className="menubar-dropdown-item"
            onClick={() => {
              onStartRenameQuery(contextMenu.query.id, contextMenu.query.title);
              onClose();
            }}
          >
            <Edit2 size={12} /> <span>Rename Query</span>
          </button>
          <button
            type="button"
            className="menubar-dropdown-item text-[var(--error)]"
            onClick={() => {
              onRemoveSavedQuery(contextMenu.query.id);
              onClose();
            }}
          >
            <Trash2 size={12} /> <span>Delete Query</span>
          </button>
        </>
      )}
    </div>
  );
};
