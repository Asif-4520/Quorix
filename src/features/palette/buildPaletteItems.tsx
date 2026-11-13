import { Columns, Eye, Layers, Table } from 'lucide-react';
import { EngineIcon, FunctionIcon, SqlQueryIcon } from '../../components/ui/DatabaseIcons';
import type {
  SavedConnection,
  SavedQuery,
  SchemaIntrospection,
  TableInfo,
} from '../../types/database';
import { type BuildCommandItemsParams, buildCommandPaletteActions } from './buildCommandItems';
import type { PaletteItem } from './paletteTypes';

export interface BuildAllPaletteItemsParams extends BuildCommandItemsParams {
  schema: SchemaIntrospection | null;
  savedQueries: SavedQuery[];
  savedConnections: SavedConnection[];
  onOpenTable: (table: TableInfo) => void;
  onOpenSchema?: (schemaName: string) => void;
  onOpenSavedQuery?: (query: SavedQuery) => void;
  onSelectSavedConnection?: (conn: SavedConnection) => void;
}

export function buildPaletteItems(params: BuildAllPaletteItemsParams): PaletteItem[] {
  const items: PaletteItem[] = buildCommandPaletteActions(params);
  const {
    schema,
    savedQueries,
    savedConnections,
    onOpenTable,
    onOpenSchema,
    onOpenSavedQuery,
    onSelectSavedConnection,
  } = params;

  if (schema) {
    for (const s of schema.schemas) {
      if (s.isSystem) continue;
      items.push({
        id: `schema-${s.name}`,
        scope: 'objects',
        category: 'Schema',
        title: s.name,
        subtitle: `${s.tableCount} tables · ${s.viewCount} views`,
        priority: 2,
        actionLabel: 'Inspect',
        icon: <Layers size={14} className="text-[var(--accent)]" />,
        action: () => onOpenSchema?.(s.name),
      });
    }

    const tableMap = new Map<string, TableInfo>();
    for (const tbl of schema.tables) {
      const key = `${tbl.schema || 'main'}.${tbl.name}`;
      tableMap.set(key, tbl);
      const isView = tbl.kind === 'view' || tbl.kind === 'materialized_view';
      items.push({
        id: `rel-${key}`,
        scope: 'objects',
        category: isView ? 'View' : 'Table',
        title: tbl.name,
        subtitle: `${tbl.schema || 'main'} · ${tbl.kind}`,
        keywords: key,
        priority: 3,
        actionLabel: 'Open',
        icon: isView ? (
          <Eye size={14} className="text-[var(--info)]" />
        ) : (
          <Table size={14} className="text-[var(--accent)]" />
        ),
        action: () => onOpenTable(tbl),
      });
    }

    for (const [key, cols] of Object.entries(schema.columns)) {
      const tbl = tableMap.get(key);
      if (!tbl) continue;
      for (const col of cols) {
        items.push({
          id: `col-${key}.${col.name}`,
          scope: 'fields',
          category: 'Column',
          title: col.name,
          subtitle: `${key} · ${col.dataType}`,
          keywords: `${key} ${col.dataType}`,
          priority: 1,
          actionLabel: 'Open Table',
          icon: <Columns size={13} className="text-[var(--text-muted)]" />,
          action: () => onOpenTable(tbl),
        });
      }
    }

    for (const fn of schema.functions) {
      items.push({
        id: `fn-${fn.schema || 'public'}.${fn.name}-${fn.arguments}`,
        scope: 'fields',
        category: 'Function',
        title: `${fn.name}(${fn.arguments})`,
        subtitle: `${fn.schema || 'public'} · returns ${fn.returnType}`,
        keywords: `${fn.schema || 'public'} ${fn.returnType}`,
        priority: 1,
        actionLabel: 'Inspect',
        icon: <FunctionIcon size={13} className="text-amber-500" />,
        action: () => onOpenSchema?.(fn.schema || 'public'),
      });
    }
  }

  for (const sq of savedQueries) {
    items.push({
      id: `sq-${sq.id}`,
      scope: 'saved',
      category: 'Saved Query',
      title: sq.title,
      subtitle: sq.sql.slice(0, 75),
      keywords: sq.folder || '',
      priority: 2,
      actionLabel: 'Open',
      icon: <SqlQueryIcon size={14} className="text-[var(--info)]" />,
      action: () => onOpenSavedQuery?.(sq),
    });
  }

  for (const sc of savedConnections) {
    items.push({
      id: `conn-profile-${sc.id}`,
      scope: 'saved',
      category: 'Connection Profile',
      title: sc.name,
      subtitle:
        sc.engine === 'sqlite' ? sc.path || '' : `${sc.host}:${sc.port || 5432}/${sc.database}`,
      keywords: `${sc.engine} ${sc.environment || ''}`,
      priority: 2,
      actionLabel: 'Connect',
      icon: (
        <EngineIcon
          engine={sc.engine}
          size={14}
          className={sc.engine === 'sqlite' ? 'text-[var(--success)]' : 'text-[var(--info)]'}
        />
      ),
      action: () => onSelectSavedConnection?.(sc),
    });
  }

  return items.filter((item) => !item.disabled);
}
