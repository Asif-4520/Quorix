import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SettingsWindowApp } from '../app/SettingsWindowApp';
import { Checkbox } from '../components/ui/Checkbox';
import { QuorixLogo } from '../components/ui/QuorixLogo';
import { TooltipHost } from '../components/ui/TooltipHost';
import { ConnectionModal } from '../features/connections/ConnectionModal';
import { SettingsModal } from '../features/settings/SettingsModal';
import { ShortcutsModal } from '../features/shortcuts/ShortcutsModal';
import { DEFAULT_SETTINGS } from '../services/storage';
import { useSettingsStore } from '../stores/settingsStore';

describe('Connections, Settings & UI Primitives', () => {
  it('SettingsModal exposes clean sections, searches across categories, and opens Keybindings window', () => {
    const onOpenShortcuts = vi.fn();
    const onClose = vi.fn();
    render(
      <SettingsModal
        isOpen
        onClose={onClose}
        onOpenShortcuts={onOpenShortcuts}
        onRequestConfirm={vi.fn()}
      />,
    );
    for (const label of [
      'Appearance',
      'Editor',
      'Data Grid',
      'Database',
      'Workspace',
      'Performance',
      'Security',
      'Advanced',
      'About',
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }

    const search = screen.getByPlaceholderText(/Search settings/i);
    fireEvent.change(search, { target: { value: 'pgbouncer' } });
    expect(screen.getByText(/PgBouncer Pooling/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Keybindings/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onOpenShortcuts).toHaveBeenCalledTimes(1);
  });

  it('Checkbox renders crisp accessible state including indeterminate, label click, and Space toggle', () => {
    const onChange = vi.fn();
    render(<Checkbox checked={false} indeterminate onChange={onChange} label="Select All Rows" />);
    const box = screen.getByRole('checkbox');
    expect(box).toHaveAttribute('aria-checked', 'mixed');
    fireEvent.click(box);
    fireEvent.click(screen.getByText('Select All Rows'));
    fireEvent.keyDown(box, { key: ' ' });
    expect(onChange).toHaveBeenCalledTimes(3);
    expect(onChange).toHaveBeenLastCalledWith(true);
  });

  it('ConnectionModal renders calm split studio with Step 1 DB selector and Step 2 URL/fields/options/file views', () => {
    render(<ConnectionModal isOpen onClose={vi.fn()} onShowToast={vi.fn()} />);

    expect(screen.getByText(/Step 1 of 2/i)).toBeInTheDocument();
    expect(document.querySelector('[data-icon="postgres"]')).not.toBeNull();
    expect(document.querySelector('[data-icon="mysql"]')).not.toBeNull();
    expect(document.querySelector('[data-icon="sqlite"]')).not.toBeNull();
    expect(document.querySelector('[data-icon="duckdb"]')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Next: Configure PostgreSQL/i }));
    expect(screen.getByText(/Step 2 of 2/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('localhost')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Options & Security/i }));
    expect(screen.getByText(/PgBouncer Mode/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^General$/i }));

    fireEvent.click(screen.getByRole('button', { name: /Connection URL/i }));
    const urlInput = screen.getByPlaceholderText(/postgresql:\/\/user:password@host/i);
    fireEvent.change(urlInput, {
      target: {
        value: 'postgresql://alice:secret@db.example.com:5433/analytics?sslmode=require',
      },
    });
    expect(screen.getByText('db.example.com')).toBeInTheDocument();
    expect(screen.getByText('analytics')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Supported DBs/i }));
    fireEvent.click(screen.getByRole('radio', { name: /MySQL \/ MariaDB/i }));
    fireEvent.click(screen.getByRole('button', { name: /Next: Configure MySQL \/ MariaDB/i }));
    fireEvent.click(screen.getByRole('button', { name: /Connection URL/i }));
    expect(screen.getByPlaceholderText(/mysql:\/\/user:password@host:3306/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Back/i }));
    fireEvent.click(screen.getByRole('radio', { name: /SQLite/i }));
    fireEvent.click(screen.getByRole('button', { name: /Next: Configure SQLite/i }));
    expect(screen.getByRole('button', { name: /Browse File/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New File/i })).toBeInTheDocument();
  });

  it('SettingsModal provides a single Global Font Size control and independent SQL Editor font controls', () => {
    render(<SettingsModal isOpen onClose={vi.fn()} onRequestConfirm={vi.fn()} />);

    expect(screen.getByText('Global Font Size')).toBeInTheDocument();
    expect(screen.queryByLabelText('UI Font Size px')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '16px' }));
    expect(document.documentElement.style.fontSize).toBe('16px');
    expect(document.documentElement.style.getPropertyValue('--quorix-editor-font-size')).toBe(
      '16px',
    );
    expect(document.documentElement.style.getPropertyValue('--quorix-grid-font-size')).toBe('16px');

    const fontSelect = screen.getByLabelText('Interface Font Preset');
    fireEvent.change(fontSelect, {
      target: { value: 'Georgia, Cambria, "Times New Roman", serif' },
    });
    expect(document.documentElement.style.getPropertyValue('--quorix-ui-font')).toBe(
      'Georgia, Cambria, "Times New Roman", serif',
    );
    expect(document.documentElement.style.getPropertyValue('--font-sans')).toBe(
      'Georgia, Cambria, "Times New Roman", serif',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Editor' }));
    const editorFontSelect = screen.getByLabelText('SQL Editor Font Preset');
    fireEvent.change(editorFontSelect, {
      target: { value: 'Consolas, "Cascadia Mono", ui-monospace, monospace' },
    });
    expect(document.documentElement.style.getPropertyValue('--quorix-editor-font')).toBe(
      'Consolas, "Cascadia Mono", ui-monospace, monospace',
    );

    const editorSizeStepper = screen.getByLabelText('Editor Font Size px');
    fireEvent.change(editorSizeStepper, { target: { value: '20' } });
    expect(document.documentElement.style.getPropertyValue('--quorix-editor-font-size')).toBe(
      '20px',
    );
    expect(document.documentElement.style.fontSize).toBe('16px');

    fireEvent.click(screen.getByRole('button', { name: 'Data Grid' }));
    expect(screen.queryByText('Row Height')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Comfortable' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Compact' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Appearance' }));
    fireEvent.click(screen.getByRole('button', { name: '13px' }));
    fireEvent.change(screen.getByLabelText('Interface Font Preset'), {
      target: {
        value: 'Inter, "Segoe UI", system-ui, -apple-system, sans-serif',
      },
    });
  });

  it('TooltipHost shows themed tooltip with shortcut keycap on hover and restores native title on leave', () => {
    vi.useFakeTimers();
    try {
      render(
        <>
          <button type="button" title="Command Palette (Ctrl+Shift+P)">
            Cmd
          </button>
          <TooltipHost />
        </>,
      );

      const btn = screen.getByRole('button', { name: 'Cmd' });
      fireEvent.mouseOver(btn);
      expect(btn).not.toHaveAttribute('title');

      act(() => {
        vi.advanceTimersByTime(300);
      });
      const tip = screen.getByRole('tooltip');
      expect(tip).toHaveTextContent('Command Palette');
      expect(tip).toHaveTextContent('Ctrl+Shift+P');

      fireEvent.mouseOut(btn);
      expect(screen.queryByRole('tooltip')).toBeNull();
      expect(btn).toHaveAttribute('title', 'Command Palette (Ctrl+Shift+P)');
    } finally {
      vi.useRealTimers();
    }
  });

  it('SettingsModal About section shows version, owner Asif Hossain, GitHub links, and ShortcutsModal includes Settings shortcuts', () => {
    render(
      <SettingsModal
        isOpen
        initialTab="about"
        onClose={vi.fn()}
        onOpenShortcuts={vi.fn()}
        onRequestConfirm={vi.fn()}
      />,
    );

    expect(screen.getByText('About Quorix')).toBeInTheDocument();
    expect(screen.getAllByText('v0.1.0').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Built by Asif Hossain/i)).toBeInTheDocument();
    expect(screen.getByText('github.com/Asif-4520')).toBeInTheDocument();
    expect(screen.getByText('github.com/Asif-4520/Quorix')).toBeInTheDocument();

    render(<ShortcutsModal isOpen onClose={vi.fn()} onRequestConfirm={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /^Settings$/i }));
    expect(screen.getByText('Settings: SQL Editor Preferences')).toBeInTheDocument();
    expect(screen.getByText('Settings: Toggle Dark / Light Mode')).toBeInTheDocument();
  });

  it('SettingsWindowApp renders standalone Preferences Studio with arrow navigation, bottom-left Keybindings card, and no header shortcut button', () => {
    act(() => {
      useSettingsStore.getState().updateSettings({ ...DEFAULT_SETTINGS, pgbouncerDefault: true });
    });

    render(<SettingsWindowApp />);
    expect(screen.getByText('Preferences Studio')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Close Settings' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Toggle Settings JSON' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Open Keybindings Window' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Open Shortcuts Studio' })).toBeNull();
    expect(screen.getByRole('button', { name: /Keybindings/i })).toBeInTheDocument();
    expect(screen.queryByText('Opens in separate window')).toBeNull();
    expect(screen.queryByText('v0.1.0')).toBeNull();

    const appearanceTab = screen.getByRole('button', { name: 'Appearance' });
    appearanceTab.focus();
    fireEvent.keyDown(appearanceTab, { key: 'ArrowDown' });
    expect(screen.getByText('SQL Query Font & Spacing')).toBeInTheDocument();

    const editorTab = screen.getByRole('button', { name: 'Editor' });
    fireEvent.keyDown(editorTab, { key: 'ArrowUp' });
    expect(screen.getByText('Global Font Size')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
    expect(screen.getByText('Query Execution & Explain')).toBeInTheDocument();
    expect(screen.getByText('Explain Plan Mode')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Estimate Only' })).toBeInTheDocument();
    expect(screen.getByLabelText('Warn on Unfiltered Writes')).toBeInTheDocument();
    expect(screen.getByLabelText('Log Failed Queries to History')).toBeInTheDocument();
    expect(screen.getByText('Workspace & Cache')).toBeInTheDocument();
    expect(screen.getByText('Storage & Diagnostics')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Copy Diagnostics/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Estimate Only' }));
    expect(useSettingsStore.getState().settings.explainAnalyze).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Filter Modified Settings' }));
    expect(screen.getByText(/PgBouncer Pooling/i)).toBeInTheDocument();

    fireEvent.keyDown(window, { key: '2', ctrlKey: true });
    expect(screen.getByText('SQL Query Font & Spacing')).toBeInTheDocument();

    act(() => {
      useSettingsStore.getState().updateSettings(DEFAULT_SETTINGS);
    });
  });

  it('QuorixLogo automatically selects transparent mark vs framed badge assets for dark and light themes', () => {
    act(() => {
      useSettingsStore.getState().setThemePreset('obsidian-dark');
    });
    const { rerender } = render(<QuorixLogo variant="mark" />);
    const markImg = screen.getByRole('img', { name: 'Quorix' }) as HTMLImageElement;
    expect(markImg).toHaveAttribute('data-quorix-logo', 'mark');
    expect(markImg).toHaveAttribute('data-logo-tone', 'dark');
    expect(markImg.src).toContain('quorix-mark-dark');

    act(() => {
      useSettingsStore.getState().setThemePreset('pearl-light');
    });
    rerender(<QuorixLogo variant="mark" />);
    expect(markImg).toHaveAttribute('data-logo-tone', 'light');
    expect(markImg.src).toContain('quorix-mark-light');

    rerender(<QuorixLogo variant="badge" />);
    expect(markImg).toHaveAttribute('data-quorix-logo', 'badge');
    expect(markImg).toHaveAttribute('data-logo-tone', 'light');
    expect(markImg.src).toContain('quorix-badge-light');

    act(() => {
      useSettingsStore.getState().setThemePreset('obsidian-dark');
    });
    rerender(<QuorixLogo variant="badge" />);
    expect(markImg).toHaveAttribute('data-logo-tone', 'dark');
    expect(markImg.src).toContain('quorix-badge-dark');
  });
});
