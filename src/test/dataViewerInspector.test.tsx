import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StrictMode, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ColumnVisibilityPicker } from '../features/dataviewer/ColumnVisibilityPicker';
import { DataViewer } from '../features/dataviewer/DataViewer';
import { FilterBuilder } from '../features/dataviewer/FilterBuilder';
import { RecordsGrid } from '../features/dataviewer/grid/RecordsGrid';
import { InspectorPanel } from '../features/inspector/InspectorPanel';
import * as tauriService from '../services/tauri';
import { useWorkspaceStore } from '../stores/workspaceStore';
import type { ColumnInfo } from '../types/database';

const SAMPLE_COLUMNS: ColumnInfo[] = [
  {
    name: 'id',
    dataType: 'uuid',
    nullable: false,
    primaryKey: true,
    isUnique: true,
    isIdentity: false,
    isGenerated: false,
    autoIncrement: false,
    ordinalPosition: 1,
    enumValues: [],
  },
  {
    name: 'email',
    dataType: 'text',
    nullable: false,
    primaryKey: false,
    isUnique: true,
    isIdentity: false,
    isGenerated: false,
    autoIncrement: false,
    ordinalPosition: 2,
    enumValues: [],
  },
];

const GRID_DRAG_DATA = {
  queryId: 'q-drag',
  columns: ['id', 'email'],
  columnTypes: ['uuid', 'text'],
  rows: [
    ['1', 'alice@example.com'],
    ['2', 'bob@example.com'],
    ['3', 'carol@example.com'],
  ],
  affectedRows: 0,
  durationMs: 2,
  totalRows: 3,
  truncated: false,
  statementType: 'SELECT',
  usesRowid: false,
};
const GRID_DRAG_COL_ORDER = ['id', 'email'];
const GRID_DRAG_EMPTY_VISIBILITY = {};
const GRID_DRAG_EMPTY_SET = new Set<string>();
const GRID_DRAG_EMPTY_UPDATES = {};
const GRID_DRAG_NOOP = () => {};

const GridDragHarness = ({
  onSelectRowRange,
}: {
  onSelectRowRange: (fromIdx: number, toIdx: number) => void;
}) => {
  const [selectedCell, setSelectedCell] = useState<{
    rowIdx: number;
    colName: string;
  } | null>(null);
  return (
    <RecordsGrid
      data={GRID_DRAG_DATA}
      columnMeta={SAMPLE_COLUMNS}
      loading={false}
      nullDisplay="NULL"
      dateFormat="iso"
      editable={false}
      readOnlyConnection={false}
      page={0}
      pageSize={50}
      onPageChange={GRID_DRAG_NOOP}
      onPageSizeChange={GRID_DRAG_NOOP}
      sortColumn={null}
      sortDesc={false}
      onSort={GRID_DRAG_NOOP}
      columnOrder={GRID_DRAG_COL_ORDER}
      onColumnOrderChange={GRID_DRAG_NOOP}
      columnVisibility={GRID_DRAG_EMPTY_VISIBILITY}
      onColumnVisibilityChange={GRID_DRAG_NOOP}
      selectedRowKeys={GRID_DRAG_EMPTY_SET}
      onToggleRowSelection={GRID_DRAG_NOOP}
      onSelectRowRange={onSelectRowRange}
      onToggleAllPageRows={GRID_DRAG_NOOP}
      selectedCell={selectedCell}
      onSelectCell={setSelectedCell}
      editingCell={null}
      editValue=""
      onStartEdit={GRID_DRAG_NOOP}
      onEditValueChange={GRID_DRAG_NOOP}
      onCommitEdit={GRID_DRAG_NOOP}
      onCancelEdit={GRID_DRAG_NOOP}
      pendingCellUpdates={GRID_DRAG_EMPTY_UPDATES}
      pendingDeletes={GRID_DRAG_EMPTY_SET}
      onInspectRow={GRID_DRAG_NOOP}
      onQuickFilter={GRID_DRAG_NOOP}
      onStageDeleteRow={GRID_DRAG_NOOP}
      onCopyToast={GRID_DRAG_NOOP}
      getRowKey={(i) => `row-${i}`}
    />
  );
};

const InspectorWorkspaceHarness = () => {
  const inspectorOpen = useWorkspaceStore((s) => s.inspectorOpen);
  const inspectorTarget = useWorkspaceStore((s) => s.inspectorTarget);
  const setInspectorOpen = useWorkspaceStore((s) => s.setInspectorOpen);
  return (
    <div className="relative flex-1 flex flex-col">
      <DataViewer
        tabId="tab-users-dbl"
        table={{
          name: 'users',
          schema: 'public',
          kind: 'table',
          hasPrimaryKey: true,
          isStrict: false,
          withoutRowid: false,
        }}
        activeSubTab="data"
        currentConnection={{
          id: 'pg-1',
          name: 'Local PG',
          engine: 'postgres',
          engineKind: 'postgres',
          readOnly: false,
          location: 'localhost:5432/app',
          connectedAtMs: 1000,
        }}
        onShowToast={GRID_DRAG_NOOP}
        onRequestConfirm={GRID_DRAG_NOOP}
        onNavigateToTable={GRID_DRAG_NOOP}
      />
      {inspectorOpen && (
        <InspectorPanel
          target={inspectorTarget}
          width={340}
          onResizeWidth={GRID_DRAG_NOOP}
          onClose={() => setInspectorOpen(false)}
          onShowToast={GRID_DRAG_NOOP}
        />
      )}
    </div>
  );
};

describe('DataViewer Subcomponents', () => {
  it('toggles column visibility once per click without double-toggle bug', () => {
    const onToggle = vi.fn();
    render(
      <ColumnVisibilityPicker
        columns={SAMPLE_COLUMNS}
        columnOrder={['id', 'email']}
        columnVisibility={{ id: true, email: true }}
        onToggleColumn={onToggle}
        onSetAll={vi.fn()}
        onMoveColumn={vi.fn()}
        onResetOrder={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const emailRow = screen.getByText('email');
    fireEvent.click(emailRow);
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith('email');
  });

  it('triggers Apply in FilterBuilder when clicked', () => {
    const onApply = vi.fn();
    render(
      <FilterBuilder
        columns={SAMPLE_COLUMNS}
        rules={[{ id: 'r1', column: 'email', operator: 'contains', value: 'quorix' }]}
        filterLogic="and"
        onChangeLogic={vi.fn()}
        onAddRule={vi.fn()}
        onUpdateRule={vi.fn()}
        onRemoveRule={vi.fn()}
        onApply={onApply}
        onClearAll={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('Apply'));
    expect(onApply).toHaveBeenCalledTimes(1);
  });
});

describe('DataViewer, RecordsGrid & Inspector UI', () => {
  it('RecordsGrid supports mouse-free row navigation, Shift+Arrow range selection, Tab wrap, and Escape clear', () => {
    const onSelectCell = vi.fn();
    const onSelectRowRange = vi.fn();
    const onClearRowSelection = vi.fn();
    const onToggleRowSelection = vi.fn();

    const sampleData = {
      queryId: 'q-1',
      columns: ['id', 'email'],
      columnTypes: ['uuid', 'text'],
      rows: [
        ['1', 'a@quorix.dev'],
        ['2', 'b@quorix.dev'],
        ['3', 'c@quorix.dev'],
      ],
      affectedRows: 0,
      durationMs: 2,
      totalRows: 3,
      truncated: false,
      statementType: 'SELECT',
      usesRowid: false,
    };

    const baseProps = {
      data: sampleData,
      columnMeta: SAMPLE_COLUMNS,
      loading: false,
      nullDisplay: 'NULL' as const,
      dateFormat: 'iso' as const,
      editable: true,
      readOnlyConnection: false,
      page: 0,
      pageSize: 50,
      onPageChange: vi.fn(),
      onPageSizeChange: vi.fn(),
      sortColumn: null,
      sortDesc: false,
      onSort: vi.fn(),
      columnOrder: ['id', 'email'],
      onColumnOrderChange: vi.fn(),
      columnVisibility: {},
      onColumnVisibilityChange: vi.fn(),
      onToggleRowSelection,
      onSelectRowRange,
      onClearRowSelection,
      onToggleAllPageRows: vi.fn(),
      onSelectCell,
      editingCell: null,
      editValue: '',
      onStartEdit: vi.fn(),
      onEditValueChange: vi.fn(),
      onCommitEdit: vi.fn(),
      onCancelEdit: vi.fn(),
      pendingCellUpdates: {},
      pendingDeletes: new Set<string>(),
      onInspectRow: vi.fn(),
      onQuickFilter: vi.fn(),
      onStageDeleteRow: vi.fn(),
      onCopyToast: vi.fn(),
      getRowKey: (i: number) => `row-${i}`,
    };

    const { rerender } = render(
      <RecordsGrid
        {...baseProps}
        selectedRowKeys={new Set()}
        selectedCell={{ rowIdx: 0, colName: 'id' }}
      />,
    );

    const grid = document.querySelector('[data-grid-focus-target="true"]');
    expect(grid).not.toBeNull();
    if (!grid) throw new Error('Expected grid focus target');

    fireEvent.keyDown(grid, { key: 'ArrowDown', shiftKey: true });
    expect(onSelectRowRange).toHaveBeenCalledWith(0, 1);
    expect(onSelectCell).toHaveBeenCalledWith({ rowIdx: 1, colName: 'id' });

    fireEvent.keyDown(grid, { key: 'ArrowDown', ctrlKey: true });
    expect(onSelectCell).toHaveBeenCalledWith({ rowIdx: 2, colName: 'id' });

    fireEvent.keyDown(grid, { key: ' ', shiftKey: true });
    expect(onToggleRowSelection).toHaveBeenCalledWith('row-0', false, 0);

    rerender(
      <RecordsGrid
        {...baseProps}
        selectedRowKeys={new Set(['row-0', 'row-1'])}
        selectedCell={{ rowIdx: 0, colName: 'email' }}
      />,
    );

    fireEvent.keyDown(grid, { key: 'Tab' });
    expect(onSelectCell).toHaveBeenCalledWith({ rowIdx: 1, colName: 'id' });

    fireEvent.keyDown(grid, { key: 'Escape' });
    expect(onClearRowSelection).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(grid, { key: 'ArrowRight', ctrlKey: true });
    expect(onSelectCell).toHaveBeenCalledWith({ rowIdx: 0, colName: 'email' });
    fireEvent.keyDown(grid, { key: 'ArrowLeft', ctrlKey: true });
    expect(onSelectCell).toHaveBeenCalledWith({ rowIdx: 0, colName: 'id' });
  });

  it('DataViewer supports Alt+G quick focus, Shift+Space full-row select, Delete confirmation, and Shift+Delete instant delete', async () => {
    const heightSpy = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600);
    const widthSpy = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
    const detailsSpy = vi.spyOn(tauriService, 'getTableDetails').mockResolvedValue({
      table: {
        name: 'users',
        schema: 'public',
        kind: 'table',
        hasPrimaryKey: true,
        isStrict: false,
        withoutRowid: false,
      },
      columns: SAMPLE_COLUMNS,
      foreignKeys: [],
      indexes: [],
      constraints: [],
      triggers: [],
      statistics: { exactRowCount: 2 },
      ddl: 'CREATE TABLE public.users (id uuid PRIMARY KEY, email text NOT NULL);',
      editable: true,
      primaryKeyColumns: ['id'],
      usesRowid: false,
    });
    const dataSpy = vi.spyOn(tauriService, 'getTableData').mockResolvedValue({
      queryId: 'q-users',
      columns: ['id', 'email'],
      columnTypes: ['uuid', 'text'],
      rows: [
        ['101', 'alice@quorix.dev'],
        ['102', 'bob@quorix.dev'],
      ],
      affectedRows: 0,
      durationMs: 3,
      totalRows: 2,
      truncated: false,
      statementType: 'SELECT',
      usesRowid: false,
    });
    const applySpy = vi.spyOn(tauriService, 'applyTableChanges').mockResolvedValue(1);

    const onRequestConfirm = vi.fn();
    const onShowToast = vi.fn();

    render(
      <DataViewer
        tabId="tab-users"
        table={{
          name: 'users',
          schema: 'public',
          kind: 'table',
          hasPrimaryKey: true,
          isStrict: false,
          withoutRowid: false,
        }}
        activeSubTab="data"
        currentConnection={{
          id: 'pg-1',
          name: 'Local PG',
          engine: 'postgres',
          engineKind: 'postgres',
          readOnly: false,
          location: 'localhost:5432/app',
          connectedAtMs: 1000,
        }}
        onShowToast={onShowToast}
        onRequestConfirm={onRequestConfirm}
        onNavigateToTable={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByText('alice@quorix.dev')).toBeInTheDocument());

    expect(screen.queryByRole('button', { name: /^Seed$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^(Comfort|Compact)$/i })).toBeNull();

    const grid = document.querySelector<HTMLElement>('[data-grid-focus-target="true"]');
    expect(grid).not.toBeNull();
    if (!grid) throw new Error('Expected grid focus container');

    grid.blur();
    fireEvent.keyDown(window, { key: 'g', altKey: true });
    await waitFor(() => expect(document.activeElement).toBe(grid));

    fireEvent.keyDown(grid, { key: ' ', shiftKey: true });
    await waitFor(() =>
      expect(document.querySelector('[data-row-index="0"]')?.getAttribute('aria-selected')).toBe(
        'true',
      ),
    );

    fireEvent.keyDown(grid, { key: 'Delete' });
    expect(onRequestConfirm).toHaveBeenCalledTimes(1);
    expect(applySpy).not.toHaveBeenCalled();

    const confirmCallback = onRequestConfirm.mock.calls[0][3] as () => Promise<void>;
    await confirmCallback();
    expect(applySpy).toHaveBeenCalledTimes(1);
    expect(applySpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        table: 'users',
        mutations: [expect.objectContaining({ operation: 'delete' })],
      }),
    );

    fireEvent.keyDown(grid, { key: ' ', shiftKey: true });
    fireEvent.keyDown(grid, { key: 'Delete', shiftKey: true });
    await waitFor(() => expect(applySpy).toHaveBeenCalledTimes(2));
    expect(onRequestConfirm).toHaveBeenCalledTimes(1);

    heightSpy.mockRestore();
    widthSpy.mockRestore();
    detailsSpy.mockRestore();
    dataSpy.mockRestore();
    applySpy.mockRestore();
  });

  it('RecordsGrid top row shows normalized type badges, column menu management, and Dim Repeats toggle', () => {
    const heightSpy = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600);
    const widthSpy = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
    const onSort = vi.fn();
    const onColumnVisibilityChange = vi.fn();

    render(
      <RecordsGrid
        data={{
          queryId: 'q-grid',
          columns: ['id', 'email', 'role'],
          columnTypes: ['uuid', 'character varying(255)', 'text'],
          rows: [
            ['1', 'alice@quorix.dev', 'admin'],
            ['2', 'bob@quorix.dev', 'admin'],
          ],
          affectedRows: 0,
          durationMs: 2,
          totalRows: 2,
          truncated: false,
          statementType: 'SELECT',
          usesRowid: false,
        }}
        columnMeta={[
          ...SAMPLE_COLUMNS,
          {
            name: 'role',
            dataType: 'character varying',
            nullable: false,
            primaryKey: false,
            isUnique: false,
            isIdentity: false,
            isGenerated: false,
            autoIncrement: false,
            ordinalPosition: 3,
            enumValues: [],
          },
        ]}
        loading={false}
        nullDisplay="NULL"
        dateFormat="iso"
        editable
        readOnlyConnection={false}
        page={0}
        pageSize={50}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
        sortColumn={null}
        sortDesc={false}
        onSort={onSort}
        columnOrder={['id', 'email', 'role']}
        onColumnOrderChange={vi.fn()}
        columnVisibility={{}}
        onColumnVisibilityChange={onColumnVisibilityChange}
        selectedRowKeys={new Set()}
        onToggleRowSelection={vi.fn()}
        onToggleAllPageRows={vi.fn()}
        selectedCell={null}
        onSelectCell={vi.fn()}
        editingCell={null}
        editValue=""
        onStartEdit={vi.fn()}
        onEditValueChange={vi.fn()}
        onCommitEdit={vi.fn()}
        onCancelEdit={vi.fn()}
        pendingCellUpdates={{}}
        pendingDeletes={new Set()}
        onInspectRow={vi.fn()}
        onQuickFilter={vi.fn()}
        onStageDeleteRow={vi.fn()}
        onCopyToast={vi.fn()}
        getRowKey={(i) => `row-${i}`}
      />,
    );

    expect(screen.getByText('id')).toBeInTheDocument();
    expect(screen.getByText('email')).toBeInTheDocument();
    expect(screen.getByText('role')).toBeInTheDocument();
    expect(screen.queryByText('uuid')).toBeNull();
    expect(screen.getByTitle(/role \(character varying\)/i)).toBeInTheDocument();

    const dimBtn = screen.getByRole('button', { name: /Dim Repeats/i });
    fireEvent.click(dimBtn);
    expect(document.querySelectorAll('[data-repeated-cell="true"]').length).toBe(1);

    fireEvent.click(screen.getByLabelText('Column actions for role'));
    expect(screen.getByText('Pin Column Left')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Hide Column'));
    expect(onColumnVisibilityChange).toHaveBeenCalledTimes(1);

    heightSpy.mockRestore();
    widthSpy.mockRestore();
  });

  it('supports Excel-style top-to-bottom cell/gutter drag selection and fast cell shortcuts', () => {
    const heightSpy = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(400);
    const widthSpy = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
    const onSelectRowRange = vi.fn();

    render(<GridDragHarness onSelectRowRange={onSelectRowRange} />);

    const cell0Email = document.querySelector('[data-cell-coord="0:email"]') as HTMLElement;
    const cell2Email = document.querySelector('[data-cell-coord="2:email"]') as HTMLElement;
    expect(cell0Email).toBeTruthy();
    expect(cell2Email).toBeTruthy();

    fireEvent.mouseDown(cell0Email, { button: 0 });
    fireEvent.mouseEnter(cell2Email);
    fireEvent.mouseUp(window);

    expect(onSelectRowRange).toHaveBeenCalledWith(0, 2);
    expect(document.querySelectorAll('[data-in-range="true"]').length).toBe(3);
    expect(screen.getByText('3×1 cells')).toBeInTheDocument();

    const grid = document.querySelector('[data-grid-focus-target="true"]') as HTMLElement;
    expect(grid).toBeTruthy();
    fireEvent.keyDown(grid, { key: 'ArrowLeft', shiftKey: true });
    expect(document.querySelectorAll('[data-in-range="true"]').length).toBe(6);
    expect(screen.getByText('3×2 cells')).toBeInTheDocument();

    fireEvent.mouseDown(cell0Email, { button: 0 });
    fireEvent.mouseUp(window);
    fireEvent.keyDown(grid, { key: ' ', code: 'Space', ctrlKey: true });
    expect(document.querySelectorAll('[data-in-range="true"]').length).toBe(3);

    onSelectRowRange.mockClear();
    const gutter0 = document.querySelector('[data-row-gutter="0"]') as HTMLElement;
    const gutter2 = document.querySelector('[data-row-gutter="2"]') as HTMLElement;
    fireEvent.mouseDown(gutter0, { button: 0 });
    fireEvent.mouseEnter(gutter2);
    fireEvent.mouseUp(window);
    expect(onSelectRowRange).toHaveBeenCalledWith(0, 2);
    expect(document.querySelectorAll('[data-in-range="true"]').length).toBe(6);

    fireEvent.keyDown(grid, { key: 'g', ctrlKey: true });
    const bar = document.querySelector('[data-goto-cell-bar="true"]') as HTMLElement;
    expect(bar).toBeInTheDocument();
    const rowInput = screen.getByLabelText('Jump to row number') as HTMLInputElement;
    const colSelect = screen.getByLabelText('Jump to column') as HTMLSelectElement;
    fireEvent.change(rowInput, { target: { value: '3' } });
    fireEvent.change(colSelect, { target: { value: 'email' } });
    expect(bar).toHaveTextContent('carol@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Jump' }));
    expect(document.querySelector('[data-goto-cell-bar="true"]')).toBeNull();
    expect(document.querySelector('[data-cell-coord="2:email"]')).toHaveAttribute(
      'data-active-cell',
      'true',
    );

    const cell0Id = document.querySelector('[data-cell-coord="0:id"]') as HTMLElement;
    fireEvent.mouseDown(cell0Id, { button: 0 });
    fireEvent.mouseUp(window);
    fireEvent.mouseDown(gutter0, { button: 0 });
    fireEvent.mouseEnter(gutter2);
    fireEvent.mouseUp(window);
    expect(document.querySelector('[data-goto-cell-bar="true"]')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Go to Cell/i }));
    expect(document.querySelector('[data-goto-cell-bar="true"]')).toBeInTheDocument();
    fireEvent.mouseDown(cell0Id, { button: 0 });
    fireEvent.mouseUp(window);
    expect(document.querySelector('[data-goto-cell-bar="true"]')).toBeNull();

    fireEvent.keyDown(grid, { key: 'g', ctrlKey: true });
    fireEvent.click(screen.getByRole('button', { name: /Last \(3\)/i }));
    onSelectRowRange.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Select Row' }));
    expect(onSelectRowRange).toHaveBeenCalledWith(2, 2);
    expect(document.querySelector('[data-goto-cell-bar="true"]')).toBeNull();

    heightSpy.mockRestore();
    widthSpy.mockRestore();
  });

  it('InspectorPanel renders as a non-shrinking absolute overlay drawer and closes on Escape', () => {
    const onClose = vi.fn();
    render(
      <div className="relative flex-1 flex flex-col">
        <div data-testid="table-area" className="flex-1">
          Table area
        </div>
        <InspectorPanel
          target={{
            kind: 'row',
            connectionId: 'conn-1',
            tableName: 'users',
            rowIndex: 0,
            columns: ['id', 'email'],
            row: ['1', 'alice@example.com'],
            columnMeta: SAMPLE_COLUMNS,
            selectedColName: 'email',
            readOnly: false,
          }}
          width={320}
          onResizeWidth={vi.fn()}
          onClose={onClose}
          onShowToast={vi.fn()}
        />
      </div>,
    );

    const aside = document.querySelector<HTMLElement>('[data-inspector-root="true"]');
    expect(aside).toBeTruthy();
    expect(aside?.className).toContain('absolute');
    expect(aside?.className).toContain('right-0');
    expect(aside?.className).toContain('top-0');
    expect(aside?.className).toContain('bottom-0');
    expect(aside?.className).not.toContain('shrink-0');

    if (aside) {
      fireEvent.keyDown(aside, { key: 'Escape' });
    }
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Double-clicking a DataViewer cell disables inline grid edit and opens floating Inspector in edit mode focused on that field', async () => {
    const heightSpy = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600);
    const widthSpy = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
    const detailsSpy = vi.spyOn(tauriService, 'getTableDetails').mockResolvedValue({
      table: {
        name: 'users',
        schema: 'public',
        kind: 'table',
        hasPrimaryKey: true,
        isStrict: false,
        withoutRowid: false,
      },
      columns: SAMPLE_COLUMNS,
      foreignKeys: [],
      indexes: [],
      constraints: [],
      triggers: [],
      statistics: { exactRowCount: 2 },
      ddl: 'CREATE TABLE public.users (id uuid PRIMARY KEY, email text NOT NULL);',
      editable: true,
      primaryKeyColumns: ['id'],
      usesRowid: false,
    });
    const dataSpy = vi.spyOn(tauriService, 'getTableData').mockResolvedValue({
      queryId: 'q-dbl-edit',
      columns: ['id', 'email'],
      columnTypes: ['uuid', 'text'],
      rows: [
        ['101', 'alice@quorix.dev'],
        ['102', 'bob@quorix.dev'],
      ],
      affectedRows: 0,
      durationMs: 3,
      totalRows: 2,
      truncated: false,
      statementType: 'SELECT',
      usesRowid: false,
    });

    useWorkspaceStore.setState({ inspectorOpen: false, inspectorTarget: null });

    render(
      <StrictMode>
        <InspectorWorkspaceHarness />
      </StrictMode>,
    );

    const cell = await waitFor(() => {
      const el = document.querySelector<HTMLElement>('[data-cell-coord="0:email"]');
      if (!el) throw new Error('cell not rendered');
      return el;
    });

    fireEvent.mouseDown(cell, { button: 0 });
    fireEvent.mouseUp(window);
    fireEvent.click(cell);

    fireEvent.mouseDown(cell, { button: 0 });
    fireEvent.mouseUp(window);
    fireEvent.click(cell);
    fireEvent.mouseDown(cell, { button: 0 });
    fireEvent.mouseUp(window);
    fireEvent.click(cell);
    fireEvent.dblClick(cell);

    expect(cell.querySelector('input')).toBeNull();

    const editor = await waitFor(() => screen.getByLabelText('Edit email') as HTMLTextAreaElement);
    const emailCard = document.querySelector<HTMLElement>('[data-inspector-field="email"]');
    expect(emailCard).toBeTruthy();
    expect(emailCard).toHaveAttribute('data-inspector-selected', 'true');
    expect(emailCard?.contains(editor)).toBe(true);
    expect(editor.value).toBe('alice@quorix.dev');
    await waitFor(() => {
      expect(document.activeElement).toBe(editor);
    });

    fireEvent.change(editor, { target: { value: 'alice.updated@quorix.dev' } });
    fireEvent.keyDown(editor, { key: 'Enter', ctrlKey: true });

    await waitFor(() => {
      expect(screen.queryByLabelText('Edit email')).toBeNull();
      expect(cell).toHaveTextContent('alice.updated@quorix.dev');
    });

    const filterInput = screen.getByLabelText('Filter fields by column or value');
    fireEvent.change(filterInput, { target: { value: 'updated@quorix' } });
    expect(document.querySelector('[data-inspector-field="email"]')).toBeTruthy();
    expect(document.querySelector('[data-inspector-field="id"]')).toBeNull();
    fireEvent.click(screen.getByLabelText('Clear field filter'));
    expect(document.querySelector('[data-inspector-field="id"]')).toBeTruthy();

    useWorkspaceStore.setState({ inspectorOpen: false, inspectorTarget: null });
    detailsSpy.mockRestore();
    dataSpy.mockRestore();
    heightSpy.mockRestore();
    widthSpy.mockRestore();
  });
});
