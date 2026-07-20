'use client';

import { getLanguageCatalog, type Diagnostic } from 'liveryscript';
import { defaultHighlightStyle, HighlightStyle, StreamLanguage, syntaxHighlighting, type StreamParser } from '@codemirror/language';
import { setDiagnostics, type Diagnostic as CodeMirrorDiagnostic } from '@codemirror/lint';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search';
import { bracketMatching } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { basicSetup } from 'codemirror';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { diagnosticRange } from '@/lib/studio-workbench';

export type LiverySourceEditorHandle = {
  focusDiagnostic: (diagnostic: Diagnostic) => void;
  focus: () => void;
};

type Props = {
  diagnostics: Diagnostic[];
  onChange: (source: string) => void;
  source: string;
};

const catalog = getLanguageCatalog();
const keywords = new Set(catalog.keywords);
const calls = new Set(catalog.calls.map(({ name }) => name));
const values = new Set([
  ...catalog.anchors,
  'true', 'false', 'primary', 'secondary', 'supporting', 'auto',
  'muted', 'soft', 'solid', 'ghost', 'emphasis', 'default',
  'neutral', 'info', 'success', 'warning', 'danger',
]);

const liveryParser: StreamParser<null> = {
  startState: () => null,
  token(stream) {
    if (stream.eatSpace()) return null;
    if (stream.match('//')) { stream.skipToEnd(); return 'comment'; }
    if (stream.match(/"(?:[^"\\]|\\.)*"?/)) return 'string';
    if (stream.match(/\$[A-Za-z_][\w-]*(?:\.[A-Za-z_][\w-]*)*/)) return 'variableName.special';
    if (stream.match(/-?\d+(?:\.\d+)?/)) return 'number';
    if (stream.match(/->|[{}(),.:=\[\]]/)) return 'punctuation';
    if (stream.match(/[A-Za-z_][\w-]*/)) {
      const word = stream.current();
      if (keywords.has(word)) return 'keyword';
      if (calls.has(word)) return 'variableName.function';
      if (values.has(word)) return 'atom';
      return 'variableName';
    }
    stream.next();
    return 'invalid';
  },
  languageData: { commentTokens: { line: '//' }, closeBrackets: { brackets: ['(', '[', '{', '"'] } },
};

const liveryLanguage = StreamLanguage.define(liveryParser);

const editorTheme = EditorView.theme({
  '&': { height: '100%', backgroundColor: 'transparent', color: '#e8e8ea', fontSize: '12px' },
  '.cm-scroller': { fontFamily: 'var(--studio-mono)', lineHeight: '1.65', overflow: 'auto' },
  '.cm-content': { padding: '16px 0', caretColor: '#f07596' },
  '.cm-line': { padding: '0 18px 0 10px' },
  '.cm-gutters': { backgroundColor: '#17181d', color: '#666873', border: '0', paddingLeft: '8px' },
  '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'rgb(255 255 255 / 3.5%)' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': { backgroundColor: 'rgb(240 117 150 / 24%)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-lintRange-error': { backgroundImage: 'none', borderBottom: '1px wavy #ef718f' },
  '.cm-lintRange-warning': { backgroundImage: 'none', borderBottom: '1px wavy #e6b85c' },
  '.cm-diagnostic': { fontFamily: 'var(--studio-sans)', fontSize: '11px' },
}, { dark: true });

const liveryHighlight = syntaxHighlighting(HighlightStyle.define([
  { tag: tags.keyword, color: '#f07596', fontWeight: '600' },
  { tag: tags.function(tags.variableName), color: '#8fc8e8' },
  { tag: tags.string, color: '#a9d18e' },
  { tag: tags.number, color: '#e8bc83' },
  { tag: tags.atom, color: '#c7a8ef' },
  { tag: tags.special(tags.variableName), color: '#e8bc83' },
  { tag: tags.comment, color: '#747680', fontStyle: 'italic' },
  { tag: tags.punctuation, color: '#a7a8af' },
  { tag: tags.invalid, color: '#ff728f', textDecoration: 'underline' },
]));

export const LiverySourceEditor = forwardRef<LiverySourceEditorHandle, Props>(function LiverySourceEditor(
  { diagnostics, onChange, source },
  forwardedRef,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useImperativeHandle(forwardedRef, () => ({
    focus: () => viewRef.current?.focus(),
    focusDiagnostic: (diagnostic) => {
      const view = viewRef.current;
      if (!view) return;
      const range = diagnosticRange(view.state.doc.length, diagnostic.span);
      if (range) view.dispatch({ selection: { anchor: range.from, head: range.to }, scrollIntoView: true });
      view.focus();
    },
  }), []);

  useEffect(() => {
    if (!hostRef.current) return;
    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: source,
        extensions: [
          basicSetup,
          history(),
          liveryLanguage,
          liveryHighlight,
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          bracketMatching(),
          highlightSelectionMatches(),
          keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
          EditorView.lineWrapping,
          editorTheme,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current(update.state.doc.toString());
          }),
        ],
      }),
    });
    viewRef.current = view;
    return () => { view.destroy(); viewRef.current = null; };
    // The editor owns its document after creation; external source changes are synchronized below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || view.state.doc.toString() === source) return;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: source } });
  }, [source]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const mapped: CodeMirrorDiagnostic[] = diagnostics.map((item) => {
      const range = diagnosticRange(view.state.doc.length, item.span) ?? { from: 0, to: 0 };
      return {
        ...range,
        severity: item.severity,
        message: `${item.code}: ${item.message}`,
      };
    });
    view.dispatch(setDiagnostics(view.state, mapped));
  }, [diagnostics, source]);

  return <div className="studio-code-editor" ref={hostRef} />;
});
