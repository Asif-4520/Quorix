import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShortcutsWindowApp } from '../app/ShortcutsWindowApp';
import { MenuBar } from '../features/layout/MenuBar';
import { StatusBar } from '../features/layout/StatusBar';
import { TitleBar } from '../features/layout/TitleBar';
import { ToolWindowStrip } from '../features/layout/ToolWindowStrip';
import { WorkspaceTabsBar } from '../features/layout/WorkspaceTabsBar';
import { CommandPalette } from '../features/palette/CommandPalette';
import { ShortcutsModal } from '../features/shortcuts/ShortcutsModal';
import { getEffectiveShortcut, resetAllKeybindings } from '../services/shortcuts';
import type { ColumnInfo, SchemaIntrospection } from '../types/database';

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

const SAMPLE_SCHEMA: SchemaIntrospection = {
  schemas: [{ name: 'public', isSystem: false, tableCount: 1, viewCount: 0 }],
  tables: [
    {
      name: 'users',
      schema: 'public',
      kind: 'table',
      hasPrimaryKey: true,
      isStrict: false,
      withoutRowid: false,
    },
  ],
  columns: { 'public.users': SAMPLE_COLUMNS },
  indexes: [],
  foreignKeys: [],
  triggers: [],
  functions: [],
  sequences: [],
  enumTypes: [],
  extensions: [],
};

describe('Navigation, Palette & Workspace Chrome UI', () => {
  beforeEach(() => {
    resetAllKeybindings();
  });

  it('Universal CommandPalette unifies commands, deduplicated objects, queries, and VS Code prefixes', () => {
    const onOpenTable = vi.fn();
    const onOpenErDiagram = vi.fn();
    const onOpenSavedQuery = vi.fn();
    const onSelectSavedConnection = vi.fn();
    const onClose = vi.fn();

    render(
      <CommandPalette
        isOpen
        onClose={onClose}
        isConnected
        isSqlActive={false}
        schema={SAMPLE_SCHEMA}
        savedQueries={[
          {
            id: 'sq-1',
            title: 'Active Users Report',
            sql: 'SELECT * FROM users;',
            createdAt: 1,
            updatedAt: 1,
          },
        ]}
        savedConnections={[
          {
            id: 'conn-1',
            name: 'Staging Postgres',
            engine: 'postgres',
            host: 'staging.db.local',
            port: 5432,
            database: 'app',
            user: 'postgres',
            readOnly: false,
          },
        ]}
        onOpenConnections={vi.fn()}
        onDisconnect={vi.fn()}
        onNewSqlTab={vi.fn()}
        onOpenTable={onOpenTable}
        onOpenSchema={vi.fn()}
        onOpenSavedQuery={onOpenSavedQuery}
        onSelectSavedConnection={onSelectSavedConnection}
        onOpenErDiagram={onOpenErDiagram}
        onRefreshSchema={vi.fn()}
        onExecuteQuery={vi.fn()}
        onExecuteAll={vi.fn()}
        onExplainQuery={vi.fn()}
        onToggleSidebar={vi.fn()}
        onToggleInspector={vi.fn()}
        onOpenCreateTable={vi.fn()}
        onOpenSettings={vi.fn()}
        onSetThemeMode={vi.fn()}
        onSetThemePreset={vi.fn()}
        onReopenClosedTab={vi.fn()}
        onCloseActiveTab={vi.fn()}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Universal Command Palette' })).toBeInTheDocument();

    const emailMatches = screen.getAllByText('email');
    expect(emailMatches).toHaveLength(1);

    fireEvent.click(screen.getByText('users'));
    expect(onOpenTable).toHaveBeenCalledWith(SAMPLE_SCHEMA.tables[0]);
    expect(onClose).toHaveBeenCalledTimes(1);

    const input = screen.getByPlaceholderText(/Type a command/i);
    fireEvent.change(input, { target: { value: '> ER Diagram' } });
    expect(screen.queryByText('users')).toBeNull();
    fireEvent.click(screen.getByText('Open ER Diagram'));
    expect(onOpenErDiagram).toHaveBeenCalledTimes(1);

    fireEvent.change(input, { target: { value: '$ Staging' } });
    expect(screen.getByText('Staging Postgres')).toBeInTheDocument();
    expect(screen.queryByText('Open ER Diagram')).toBeNull();
    fireEvent.click(screen.getByText('Staging Postgres'));
    expect(onSelectSavedConnection).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'conn-1', name: 'Staging Postgres' }),
    );

    fireEvent.change(input, { target: { value: '@ email' } });
    expect(screen.getByText('email')).toBeInTheDocument();
  });

  it('CommandPalette surfaces Execute All and Explain Query Plan commands when a SQL tab is active', () => {
    const onExecuteAll = vi.fn();
    const onExplainQuery = vi.fn();
    render(
      <CommandPalette
        isOpen
        onClose={vi.fn()}
        isConnected
        isSqlActive
        schema={SAMPLE_SCHEMA}
        onOpenConnections={vi.fn()}
        onDisconnect={vi.fn()}
        onNewSqlTab={vi.fn()}
        onOpenTable={vi.fn()}
        onOpenErDiagram={vi.fn()}
        onRefreshSchema={vi.fn()}
        onExecuteQuery={vi.fn()}
        onExecuteAll={onExecuteAll}
        onExplainQuery={onExplainQuery}
        onToggleSidebar={vi.fn()}
        onToggleInspector={vi.fn()}
        onOpenCreateTable={vi.fn()}
        onOpenSettings={vi.fn()}
        onSetThemeMode={vi.fn()}
        onSetThemePreset={vi.fn()}
        onReopenClosedTab={vi.fn()}
        onCloseActiveTab={vi.fn()}
      />,
    );

    const input = screen.getByPlaceholderText(/Type a command/i);
    fireEvent.change(input, { target: { value: '> Explain' } });
    fireEvent.click(screen.getByText('Explain Query Plan'));
    expect(onExplainQuery).toHaveBeenCalledTimes(1);

    fireEvent.change(input, { target: { value: '> Execute All' } });
    fireEvent.click(screen.getByText('Execute All SQL Statements'));
    expect(onExecuteAll).toHaveBeenCalledTimes(1);
  });

  it('ShortcutsModal opens in a separate window, filters by Record Key, and captures custom keystrokes', async () => {
    const onClose = vi.fn();
    render(<ShortcutsModal isOpen onClose={onClose} onRequestConfirm={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: 'Keyboard Shortcuts' })).toBeInTheDocument();
    const fullscreenTitle = screen.getByText('Toggle Fullscreen Mode');
    expect(fullscreenTitle).toBeInTheDocument();

    const recordFilterBtn = screen.getByRole('button', { name: /Record Key/i });
    fireEvent.click(recordFilterBtn);
    const filterInput = screen.getByPlaceholderText(/Press any keystroke to filter/i);
    await new Promise((r) => requestAnimationFrame(r));
    expect(document.activeElement).toBe(filterInput);
    fireEvent.keyDown(filterInput, { key: 'p', ctrlKey: true });
    expect((filterInput as HTMLInputElement).value).toBe('Ctrl+P');
    expect(screen.getByText('Quick Open Database Objects')).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Clear search'));

    fireEvent.click(screen.getByText('F11'));
    expect(
      screen.getByRole('dialog', {
        name: /Edit Keybinding: Toggle Fullscreen Mode/i,
      }),
    ).toBeInTheDocument();
    const recorderInput = screen.getByPlaceholderText(/Press keys now/i);
    fireEvent.keyDown(recorderInput, { key: 'k', ctrlKey: true, altKey: true });
    expect((recorderInput as HTMLInputElement).value).toBe('Ctrl+Alt+K');

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(getEffectiveShortcut('toggle-fullscreen')).toBe('Ctrl+Alt+K');

    const keybindingHeader = document.querySelector<HTMLElement>(
      '[data-shortcut-col="keybinding"]',
    );
    expect(keybindingHeader).not.toBeNull();
    const resizer = keybindingHeader?.querySelector('[role="separator"]');
    expect(resizer).not.toBeNull();
    if (resizer && keybindingHeader) {
      fireEvent.mouseDown(resizer, { clientX: 200 });
      fireEvent.mouseMove(window, { clientX: 260 });
      fireEvent.mouseUp(window);
      expect(keybindingHeader.style.width).toBe('270px');
      fireEvent.doubleClick(resizer);
      expect(keybindingHeader.style.width).toBe('210px');
    }

    const keyTable = screen.getByLabelText('Keybindings Table');
    fireEvent.keyDown(keyTable, { key: 'ArrowDown' });
    fireEvent.keyDown(keyTable, { key: 'Enter' });
    expect(screen.getByPlaceholderText(/Press keys now/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('button', { name: 'Open Settings' })).toBeNull();
  }, 15_000);

  it('ShortcutsWindowApp & standalone ShortcutsModal filter unbound actions and assign custom keys', () => {
    resetAllKeybindings();
    render(<ShortcutsWindowApp />);

    expect(screen.getByText('Keymap Studio')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Keyboard Shortcuts' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Close Keyboard Shortcuts' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Open Preferences Window' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Open Settings' })).toBeNull();
    expect(screen.queryByRole('separator', { name: 'Resize shortcuts window' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Export Keymap JSON' })).toBeInTheDocument();

    const unboundFilterBtn = screen.getByRole('button', { name: /^Unbound/i });
    fireEvent.click(unboundFilterBtn);
    expect(screen.getByText('Settings: Appearance & Theme')).toBeInTheDocument();
    expect(screen.getByText('SQL: Export Query Results (CSV)')).toBeInTheDocument();
    expect(screen.getByText('Grid: Jump to Last Page')).toBeInTheDocument();

    const assignBtns = screen.getAllByRole('button', { name: 'Assign keybinding' });
    fireEvent.click(assignBtns[0]);
    expect(
      screen.getByRole('dialog', {
        name: /Edit Keybinding: Settings: Appearance & Theme/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Unassigned').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole('button', { name: 'Use Default' })).toBeNull();

    const recorderInput = screen.getByPlaceholderText(/Press keys now/i);
    fireEvent.keyDown(recorderInput, { key: '9', ctrlKey: true, altKey: true });
    expect((recorderInput as HTMLInputElement).value).toBe('Ctrl+Alt+9');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(getEffectiveShortcut('open-appearance-settings')).toBe('Ctrl+Alt+9');
    resetAllKeybindings();
  });

  it('TitleBar renders File/Edit/View menu and centered DB connection switcher in top window bar', () => {
    const onSelectSavedConnection = vi.fn();
    render(
      <TitleBar
        currentConnection={{
          id: 'conn-1',
          name: 'Prod Analytics',
          engine: 'postgres',
          engineKind: 'postgres',
          readOnly: false,
          location: 'localhost:5432/analytics',
          currentDatabase: 'analytics',
          connectedAtMs: 1000,
        }}
        activeConnections={[
          {
            id: 'conn-1',
            name: 'Prod Analytics',
            engine: 'postgres',
            engineKind: 'postgres',
            readOnly: false,
            location: 'localhost:5432/analytics',
            currentDatabase: 'analytics',
            connectedAtMs: 1000,
          },
        ]}
        savedConnections={[
          {
            id: 'conn-2',
            name: 'Recent SQLite',
            engine: 'sqlite',
            path: 'C:/data/app.sqlite',
            readOnly: false,
            lastConnected: 1700000000000,
          },
          {
            id: 'conn-3',
            name: 'Staging PG',
            engine: 'postgres',
            host: 'staging.local',
            port: 5432,
            database: 'app',
            readOnly: false,
          },
        ]}
        onSwitchActiveConnection={vi.fn()}
        onSelectSavedConnection={onSelectSavedConnection}
        onOpenNewConnectionModal={vi.fn()}
        onDisconnect={vi.fn()}
        tabs={[
          {
            id: 'tab-1',
            title: 'Console 1',
            type: 'sql',
            sqlContent: 'SELECT 1;',
          },
        ]}
        activeTabId="tab-1"
        onCloseTab={vi.fn()}
        onCloseAllTabs={vi.fn()}
        onReopenClosedTab={vi.fn()}
        onNewSqlTab={vi.fn()}
        hasClosedTabs={false}
        onOpenCommandPalette={vi.fn()}
        onOpenSettings={vi.fn()}
        sidebarOpen
        onToggleSidebar={vi.fn()}
        inspectorOpen={false}
        onToggleInspector={vi.fn()}
        themeMode="dark"
        effectiveTheme="obsidian-dark"
        onSetThemeMode={vi.fn()}
        onSetThemePreset={vi.fn()}
        onCycleTheme={vi.fn()}
        onOpenErDiagram={vi.fn()}
        onRefreshSchema={vi.fn()}
        onOpenCreateTable={vi.fn()}
      />,
    );

    const fileBtn = screen.getByRole('button', { name: 'File' });
    const editBtn = screen.getByRole('button', { name: 'Edit' });
    const viewBtn = screen.getByRole('button', { name: 'View' });
    const toggleSidebarBtn = screen.getByRole('button', { name: 'Toggle Sidebar' });
    const toggleInspectorBtn = screen.getByRole('button', { name: 'Toggle Inspector Panel' });
    const minimizeBtn = screen.getByRole('button', { name: 'Minimize' });
    const maximizeBtn = screen.getByRole('button', { name: 'Maximize' });
    const closeBtn = screen.getByRole('button', { name: 'Close' });

    const topWindowRow = minimizeBtn.closest('.titlebar-window-row');
    expect(topWindowRow).not.toBeNull();
    expect(topWindowRow).toContainElement(fileBtn);
    expect(topWindowRow).toContainElement(editBtn);
    expect(topWindowRow).toContainElement(viewBtn);
    expect(topWindowRow).toContainElement(toggleSidebarBtn);
    expect(topWindowRow).toContainElement(toggleInspectorBtn);
    expect(topWindowRow).toContainElement(maximizeBtn);
    expect(topWindowRow).toContainElement(closeBtn);
    expect(screen.queryByRole('button', { name: 'Enter Fullscreen' })).toBeNull();
    expect(document.querySelector('.titlebar-search-pill')).toBeNull();

    const connPill = screen.getByText(/Prod Analytics/).closest('button');
    expect(connPill).not.toBeNull();
    if (!connPill) throw new Error('Expected connection pill button');
    expect(topWindowRow).toContainElement(connPill);
    expect(connPill).toHaveTextContent('PG');
    expect(document.querySelector('.titlebar-tabs-row')).toBeNull();
    expect(screen.queryByText('Console 1')).toBeNull();

    fireEvent.click(connPill);
    expect(screen.getByText('Recent Connections')).toBeInTheDocument();
    expect(screen.getByText('Saved Profiles')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Recent SQLite'));
    expect(onSelectSavedConnection).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'conn-2', name: 'Recent SQLite' }),
    );

    fireEvent.click(fileBtn);
    expect(screen.getByText('Exit')).toBeInTheDocument();
  });

  it('MenuBar opens File, Database, and Help menus on hover without documentation or external DB docs links', () => {
    render(
      <MenuBar
        currentConnection={null}
        activeConnections={[]}
        onSwitchConnection={vi.fn()}
        onOpenNewConnectionModal={vi.fn()}
        onDisconnect={vi.fn()}
        onNewSqlTab={vi.fn()}
        onOpenCommandPalette={vi.fn()}
        onOpenSettings={vi.fn()}
        sidebarOpen
        onToggleSidebar={vi.fn()}
        inspectorOpen={false}
        onToggleInspector={vi.fn()}
        themeMode="dark"
        effectiveTheme="obsidian-dark"
        onSetThemeMode={vi.fn()}
        onSetThemePreset={vi.fn()}
        onCycleTheme={vi.fn()}
        onCloseActiveTab={vi.fn()}
        onReopenClosedTab={vi.fn()}
        onCloseAllTabs={vi.fn()}
        onRefreshSchema={vi.fn()}
        onOpenErDiagram={vi.fn()}
        onOpenCreateTable={vi.fn()}
        hasActiveTabs={false}
        hasClosedTabs={false}
        isSqlTabActive={false}
      />,
    );

    const fileBtn = screen.getByRole('button', { name: 'File' });
    fireEvent.mouseEnter(fileBtn);
    expect(screen.getByText('New Connection…')).toBeInTheDocument();

    const dbBtn = screen.getByRole('button', { name: 'Database' });
    fireEvent.mouseEnter(dbBtn);
    expect(screen.getByText('Manage Connections…')).toBeInTheDocument();

    const helpBtn = screen.getByRole('button', { name: 'Help' });
    fireEvent.mouseEnter(helpBtn);
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
    expect(screen.getByText('About Quorix')).toBeInTheDocument();
    expect(screen.queryByText(/Documentation & Guide/i)).toBeNull();
    expect(screen.queryByText(/PostgreSQL Docs/i)).toBeNull();
    expect(screen.queryByText(/SQLite Docs/i)).toBeNull();
  });

  it('WorkspaceTabsBar shows tabs on the left and refresh/workspace actions on the right', () => {
    const onRefreshSchema = vi.fn();
    const onSelectTab = vi.fn();
    render(
      <WorkspaceTabsBar
        tabs={[
          { id: 'tab-1', title: 'users', type: 'table', tableName: 'users' },
          { id: 'tab-2', title: 'Console 1', type: 'sql', sqlContent: 'SELECT 1;' },
        ]}
        activeTabId="tab-1"
        onSelectTab={onSelectTab}
        onCloseTab={vi.fn()}
        onCloseOtherTabs={vi.fn()}
        onCloseAllTabs={vi.fn()}
        onReopenClosedTab={vi.fn()}
        onTogglePinTab={vi.fn()}
        onNewSqlTab={vi.fn()}
        hasClosedTabs={false}
        isConnected
        onRefreshSchema={onRefreshSchema}
        onOpenErDiagram={vi.fn()}
        onOpenCommandPalette={vi.fn()}
        inspectorOpen={false}
        onToggleInspector={vi.fn()}
      />,
    );

    const tabList = screen.getByRole('tablist', { name: 'Workspace Tabs' });
    const usersTab = screen.getByRole('tab', { name: 'users' });
    const consoleTab = screen.getByRole('tab', { name: 'Console 1' });
    expect(tabList).toContainElement(usersTab);
    expect(tabList).toContainElement(consoleTab);

    fireEvent.click(consoleTab);
    expect(onSelectTab).toHaveBeenCalledWith('tab-2');

    const refreshBtn = screen.getByTitle(/Refresh Schema/i);
    expect(refreshBtn).not.toBeDisabled();
    fireEvent.click(refreshBtn);
    expect(onRefreshSchema).toHaveBeenCalledTimes(1);
    expect(screen.getByTitle(/ER Diagram/i)).toBeInTheDocument();
    expect(screen.getByTitle(/Universal Command Palette/i)).toBeInTheDocument();
    expect(document.querySelector('[data-icon="sql-query"]')).not.toBeNull();
    expect(document.querySelector('[data-icon="er-diagram"]')).not.toBeNull();
  });

  it('StatusBar shows concise table count, telemetry, and quick footer actions without connection or help buttons', () => {
    const onRefreshSchema = vi.fn();
    const onNewSqlTab = vi.fn();
    const onCycleTheme = vi.fn();
    render(
      <StatusBar
        currentConnection={{
          id: 'conn-1',
          name: 'Prod DB',
          engine: 'postgres',
          engineKind: 'postgres',
          readOnly: false,
          location: 'localhost:5432/prod',
          serverVersion: 'PostgreSQL 16.2 on x86_64-pc-linux-gnu',
          connectedAtMs: 1000,
        }}
        activeConnectionCount={2}
        activeTabTitle="users"
        activeTabType="table"
        rowsInfo="Page 1 · 50 rows"
        durationMs={14}
        txState="Ready"
        tableCount={12}
        viewCount={2}
        themeName="Obsidian Dark"
        onNewSqlTab={onNewSqlTab}
        onRefreshSchema={onRefreshSchema}
        onCycleTheme={onCycleTheme}
      />,
    );

    expect(screen.queryByText('Prod DB')).toBeNull();
    expect(screen.queryByText('Help')).toBeNull();
    expect(screen.getByText('2 sessions')).toBeInTheDocument();
    expect(screen.getByText('12 tables · 2 views')).toBeInTheDocument();
    expect(screen.getByText('Page 1 · 50 rows')).toBeInTheDocument();
    expect(screen.getByText('14 ms')).toBeInTheDocument();

    fireEvent.click(screen.getByText('12 tables · 2 views'));
    expect(onRefreshSchema).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('New SQL'));
    expect(onNewSqlTab).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Obsidian Dark'));
    expect(onCycleTheme).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[data-icon="sql-query"]')).not.toBeNull();
  });

  it('uses dedicated SQL Query and ER Diagram icons inside ToolWindowStrip without connections, inspector, theme, help, or shortcuts buttons', () => {
    render(
      <ToolWindowStrip
        databaseOpen
        onToggleDatabase={vi.fn()}
        onOpenNewConsole={vi.fn()}
        onOpenErDiagram={vi.fn()}
        onOpenSettings={vi.fn()}
        isConnected
      />,
    );
    expect(document.querySelector('[data-icon="sql-query"]')).not.toBeNull();
    expect(document.querySelector('[data-icon="er-diagram"]')).not.toBeNull();
    expect(screen.queryByTitle(/Connections/i)).toBeNull();
    expect(screen.queryByTitle(/Inspector Panel/i)).toBeNull();
    expect(screen.queryByTitle(/Cycle Theme/i)).toBeNull();
    expect(screen.queryByTitle(/Help & Shortcuts/i)).toBeNull();
  });
});
