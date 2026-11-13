import { autocompletion } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { MySQL, PostgreSQL, SQLite, sql } from '@codemirror/lang-sql';
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { highlightSelectionMatches, search, searchKeymap } from '@codemirror/search';
import { Compartment, EditorState } from '@codemirror/state';
import { oneDarkHighlightStyle } from '@codemirror/theme-one-dark';
import { EditorView, highlightActiveLine, keymap, lineNumbers } from '@codemirror/view';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { AppSettings } from '../../services/storage';
import { THEMES } from '../../theme/themes';
import type { DatabaseEngine, SchemaIntrospection, ThemeName } from '../../types/database';

interface SqlCodeMirrorActions {
  executeCurrent: () => void;
  executeAll: () => void;
  explain: () => void;
  formatSql: () => void;
  saveQuery: () => void;
}

interface UseSqlCodeMirrorParams {
  initialSql: string;
  engineKind?: DatabaseEngine;
  introspection?: SchemaIntrospection;
  settings: AppSettings;
  effectiveTheme: ThemeName;
  onSqlChange: (sql: string) => void;
  actionRefs: React.MutableRefObject<SqlCodeMirrorActions>;
}

export function useSqlCodeMirror({
  initialSql,
  engineKind,
  introspection,
  settings,
  effectiveTheme,
  onSqlChange,
  actionRefs,
}: UseSqlCodeMirrorParams) {
  const mountRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const theme = THEMES[effectiveTheme] || THEMES['obsidian-dark'];

  const compartments = useMemo(
    () => ({
      dialect: new Compartment(),
      theme: new Compartment(),
      lineNumbers: new Compartment(),
      autocomplete: new Compartment(),
      wrap: new Compartment(),
      tabSize: new Compartment(),
      typography: new Compartment(),
    }),
    [],
  );

  const cmThemeExtension = useMemo(() => {
    const baseTheme = EditorView.theme(
      {
        '&': {
          backgroundColor: theme.codeBg,
          color: theme.text,
          height: '100%',
        },
        '.cm-content': {
          caretColor: theme.accent,
        },
        '.cm-cursor': {
          borderLeftColor: theme.accent,
        },
        '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
          backgroundColor: theme.selection,
        },
      },
      { dark: theme.isDark },
    );

    return [
      baseTheme,
      syntaxHighlighting(theme.isDark ? oneDarkHighlightStyle : defaultHighlightStyle),
    ];
  }, [theme]);

  const cmDialectExtension = useMemo(() => {
    const schemaMap: Record<string, string[]> = {};
    if (introspection) {
      for (const tbl of introspection.tables) {
        const key = `${tbl.schema || 'main'}.${tbl.name}`;
        const cols = (introspection.columns[key] || introspection.columns[tbl.name] || []).map(
          (c) => c.name,
        );
        schemaMap[tbl.name] = cols;
        if (tbl.schema) {
          schemaMap[`${tbl.schema}.${tbl.name}`] = cols;
        }
      }
    }
    return sql({
      dialect: engineKind === 'postgres' ? PostgreSQL : engineKind === 'mysql' ? MySQL : SQLite,
      schema: schemaMap,
      upperCaseKeywords: true,
    });
  }, [introspection, engineKind]);

  const initialMountConfigRef = useRef({
    doc: initialSql,
    dialect: cmDialectExtension,
    theme: cmThemeExtension,
    showLineNumbers: settings.editorLineNumbers ?? true,
    autocomplete: settings.editorAutocomplete,
    wrap: settings.editorWordWrap,
    tabSize: settings.editorTabSize || 2,
    fontFamily: settings.editorFontFamily,
    fontSize: settings.editorFontSize || 13,
    lineHeight: settings.editorLineHeight || 1.6,
    onSqlChange,
  });
  initialMountConfigRef.current.onSqlChange = onSqlChange;

  useEffect(() => {
    if (!mountRef.current) return;
    const init = initialMountConfigRef.current;
    const startState = EditorState.create({
      doc: init.doc,
      extensions: [
        compartments.lineNumbers.of(init.showLineNumbers ? lineNumbers() : []),
        highlightActiveLine(),
        history(),
        search({ top: true }),
        highlightSelectionMatches(),
        compartments.dialect.of(init.dialect),
        compartments.theme.of(init.theme),
        compartments.autocomplete.of(init.autocomplete ? autocompletion() : []),
        compartments.wrap.of(init.wrap ? EditorView.lineWrapping : []),
        compartments.tabSize.of(EditorState.tabSize.of(init.tabSize)),
        compartments.typography.of(
          EditorView.theme({
            '&': { fontSize: `${init.fontSize}px`, fontFamily: init.fontFamily },
            '.cm-scroller, .cm-content, .cm-gutters, .cm-line': {
              fontFamily: init.fontFamily,
              lineHeight: String(init.lineHeight),
            },
          }),
        ),
        keymap.of([
          {
            key: 'Mod-Enter',
            run: () => {
              actionRefs.current.executeCurrent();
              return true;
            },
          },
          {
            key: 'Mod-Shift-Enter',
            run: () => {
              actionRefs.current.executeAll();
              return true;
            },
          },
          {
            key: 'Mod-e',
            run: () => {
              actionRefs.current.explain();
              return true;
            },
          },
          {
            key: 'Shift-Alt-f',
            run: () => {
              actionRefs.current.formatSql();
              return true;
            },
          },
          {
            key: 'Mod-s',
            run: () => {
              actionRefs.current.saveQuery();
              return true;
            },
          },
          ...searchKeymap,
          ...defaultKeymap,
          ...historyKeymap,
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            initialMountConfigRef.current.onSqlChange(update.state.doc.toString());
          }
        }),
      ],
    });

    const view = new EditorView({ state: startState, parent: mountRef.current });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [compartments, actionRefs]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: [
        compartments.dialect.reconfigure(cmDialectExtension),
        compartments.theme.reconfigure(cmThemeExtension),
        compartments.lineNumbers.reconfigure(
          (settings.editorLineNumbers ?? true) ? lineNumbers() : [],
        ),
        compartments.autocomplete.reconfigure(settings.editorAutocomplete ? autocompletion() : []),
        compartments.wrap.reconfigure(settings.editorWordWrap ? EditorView.lineWrapping : []),
        compartments.tabSize.reconfigure(EditorState.tabSize.of(settings.editorTabSize || 2)),
        compartments.typography.reconfigure(
          EditorView.theme({
            '&': {
              fontSize: `${settings.editorFontSize || 13}px`,
              fontFamily: settings.editorFontFamily,
            },
            '.cm-scroller, .cm-content, .cm-gutters, .cm-line': {
              fontFamily: settings.editorFontFamily,
              lineHeight: String(settings.editorLineHeight || 1.6),
            },
          }),
        ),
      ],
    });
  }, [
    compartments,
    cmDialectExtension,
    cmThemeExtension,
    settings.editorLineNumbers,
    settings.editorAutocomplete,
    settings.editorWordWrap,
    settings.editorTabSize,
    settings.editorFontSize,
    settings.editorFontFamily,
    settings.editorLineHeight,
  ]);

  const getSqlToExecute = useCallback(
    (runAll: boolean): string => {
      const view = viewRef.current;
      if (!view) return initialSql;
      const sel = view.state.selection.main;
      if (!runAll && !sel.empty) {
        return view.state.sliceDoc(sel.from, sel.to);
      }
      const doc = view.state.doc.toString();
      if (runAll || !doc.includes(';')) return doc;
      const cursor = sel.head;
      const before = doc.lastIndexOf(';', Math.max(0, cursor - 1));
      const after = doc.indexOf(';', cursor);
      const start = before === -1 ? 0 : before + 1;
      const end = after === -1 ? doc.length : after + 1;
      const stmt = doc.slice(start, end).trim();
      return stmt || doc;
    },
    [initialSql],
  );

  const getDocumentText = useCallback(
    () => viewRef.current?.state.doc.toString() ?? initialSql,
    [initialSql],
  );

  const replaceDocumentText = useCallback((nextText: string) => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: nextText },
    });
  }, []);

  return {
    mountRef,
    viewRef,
    getSqlToExecute,
    getDocumentText,
    replaceDocumentText,
  };
}
