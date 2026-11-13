import type { ColumnOrderState } from '@tanstack/react-table';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getTableData, getTableDetails } from '../../services/tauri';
import type {
  ConnectionSummary,
  FilterRule,
  QueryResponse,
  TableDetailsResponse,
  TableInfo,
} from '../../types/database';

interface UseDataViewerQueriesParams {
  table: TableInfo;
  currentConnection: ConnectionSummary;
  defaultPageSize: number;
  initialFilters?: FilterRule[];
  onSetColumnOrder: React.Dispatch<React.SetStateAction<ColumnOrderState>>;
  onDataLoaded: () => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export function useDataViewerQueries({
  table,
  currentConnection,
  defaultPageSize,
  initialFilters,
  onSetColumnOrder,
  onDataLoaded,
  onShowToast,
}: UseDataViewerQueriesParams) {
  const [details, setDetails] = useState<TableDetailsResponse | null>(null);
  const [data, setData] = useState<QueryResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(defaultPageSize || 50);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDesc, setSortDesc] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [showFilterBuilder, setShowFilterBuilder] = useState(Boolean(initialFilters?.length));
  const [draftFilters, setDraftFilters] = useState<FilterRule[]>(initialFilters || []);
  const [appliedFilters, setAppliedFilters] = useState<FilterRule[]>(initialFilters || []);
  const [filterLogic, setFilterLogic] = useState<'and' | 'or'>('and');

  useEffect(() => {
    if (initialFilters && initialFilters.length > 0) {
      setDraftFilters(initialFilters);
      setAppliedFilters(initialFilters);
      setShowFilterBuilder(true);
      setPage(0);
    }
  }, [initialFilters]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(0);
    }, 220);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  const loadDetails = useCallback(async () => {
    try {
      const d = await getTableDetails(table.name, table.schema, currentConnection.id);
      setDetails(d);
      onSetColumnOrder((prev) => (prev.length > 0 ? prev : d.columns.map((c) => c.name)));
    } catch (err) {
      onShowToast(`Failed loading table metadata: ${err}`, 'error');
    }
  }, [table.name, table.schema, currentConnection.id, onSetColumnOrder, onShowToast]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getTableData({
        connectionId: currentConnection.id,
        table: table.name,
        schema: table.schema,
        page,
        pageSize,
        sortColumn: sortColumn || undefined,
        sortDesc,
        searchQuery: debouncedSearch || undefined,
        filters: appliedFilters.map(({ column, operator, value, value2 }) => ({
          column: column || undefined,
          operator,
          value,
          value2,
        })),
        filterLogic,
        includeTotalCount: true,
      });
      setData(res);
      onDataLoaded();
    } catch (err) {
      onShowToast(`Failed loading table records: ${err}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [
    currentConnection.id,
    table.name,
    table.schema,
    page,
    pageSize,
    sortColumn,
    sortDesc,
    debouncedSearch,
    appliedFilters,
    filterLogic,
    onDataLoaded,
    onShowToast,
  ]);

  useEffect(() => {
    void loadDetails();
  }, [loadDetails]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSort = useCallback(
    (colName: string) => {
      setPage(0);
      if (sortColumn === colName) {
        if (!sortDesc) {
          setSortDesc(true);
        } else {
          setSortColumn(null);
          setSortDesc(false);
        }
      } else {
        setSortColumn(colName);
        setSortDesc(false);
      }
    },
    [sortColumn, sortDesc],
  );

  const clearFiltersAndSort = useCallback(() => {
    setSearchQuery('');
    setDebouncedSearch('');
    setDraftFilters([]);
    setAppliedFilters([]);
    setSortColumn(null);
    setSortDesc(false);
    setPage(0);
    onShowToast('Cleared search, filters, and sort', 'info');
  }, [onShowToast]);

  const columnsList = useMemo(() => details?.columns || [], [details?.columns]);

  return {
    details,
    data,
    loading,
    page,
    setPage,
    pageSize,
    setPageSize,
    sortColumn,
    sortDesc,
    searchQuery,
    setSearchQuery,
    debouncedSearch,
    searchInputRef,
    showFilterBuilder,
    setShowFilterBuilder,
    draftFilters,
    setDraftFilters,
    appliedFilters,
    setAppliedFilters,
    filterLogic,
    setFilterLogic,
    columnsList,
    loadDetails,
    loadData,
    handleSort,
    clearFiltersAndSort,
  };
}
