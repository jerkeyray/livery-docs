'use client';

import { useChat } from '@ai-sdk/react';
import { getBuiltInTheme, render, visualPlanSchema, type BuiltInThemeName, type Diagnostic, type VisualPlan } from 'liveryscript';
import { LiveryChatVisual } from 'liveryscript/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { LiverySourceEditor, type LiverySourceEditorHandle } from '@/components/livery-source-editor';
import { SiteThemeToggle } from '@/components/site-theme-toggle';
import { retainVisualPlanForSource, STUDIO_CANVAS_WIDTH } from '@/lib/studio-agent';
import { studioExamples, type StudioExample } from '@/lib/studio-examples';
import { appendRevision, createRevisionState, moveRevision, replaceCurrentRevision } from '@/lib/studio-revisions';
import { clearStudioDraft, readStudioDraft, writeStudioDraft } from '@/lib/studio-storage';
import {
  calculateStudioFitZoom,
  clampStudioSidebarWidth,
  clampStudioZoom,
  STUDIO_SIDEBAR_DEFAULT,
  STUDIO_SIDEBAR_MAX,
  STUDIO_SIDEBAR_MIN,
  STUDIO_ZOOM_STEP,
  type StudioSidebarTab,
  type StudioViewportState,
} from '@/lib/studio-workbench';

const initialSource = '';

const themeOptions = [
  ['editorial', 'Editorial'],
  ['paper', 'Paper'],
  ['midnight', 'Midnight'],
  ['blackout', 'Blackout'],
  ['blueprint', 'Blueprint'],
  ['monochrome', 'Monochrome'],
] as const satisfies ReadonlyArray<readonly [BuiltInThemeName, string]>;

type SubmissionOutput = {
  accepted: boolean;
  plan?: VisualPlan;
  source?: string;
  summary?: string;
  diagnostics?: Array<{ code: string; message: string; severity?: string }>;
};

export function Studio() {
  const [input, setInput] = useState('');
  const [source, setSource] = useState(initialSource);
  const [acceptedSource, setAcceptedSource] = useState(initialSource);
  const [acceptedPlan, setAcceptedPlan] = useState<VisualPlan>();
  const [activeTab, setActiveTab] = useState<StudioSidebarTab>('chat');
  const [sidebarWidth, setSidebarWidth] = useState(STUDIO_SIDEBAR_DEFAULT);
  const [viewport, setViewport] = useState<StudioViewportState>({ mode: 'fit', zoom: 1 });
  const [contentSize, setContentSize] = useState({ width: STUDIO_CANVAS_WIDTH, height: 540 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pendingExample, setPendingExample] = useState<StudioExample>();
  const [themeName, setThemeName] = useState<BuiltInThemeName>('editorial');
  const [generationError, setGenerationError] = useState('');
  const [exportNotice, setExportNotice] = useState('');
  const [sourceCopyNotice, setSourceCopyNotice] = useState('');
  const [sourceDiagnostics, setSourceDiagnostics] = useState<Diagnostic[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [revisions, setRevisions] = useState(() => createRevisionState(initialSource));
  const theme = getBuiltInTheme(themeName);
  const hasScene = acceptedSource.trim().length > 0;
  const appliedSources = useRef(new Set([initialSource]));
  const editingRevision = useRef(false);
  const restoredDraft = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const canvasPanelRef = useRef<HTMLElement>(null);
  const canvasStageRef = useRef<HTMLDivElement>(null);
  const visualNaturalRef = useRef<HTMLDivElement>(null);
  const sourceEditorRef = useRef<LiverySourceEditorHandle>(null);
  const composerFormRef = useRef<HTMLFormElement>(null);
  const dragState = useRef<{ x: number; y: number; left: number; top: number } | undefined>(undefined);

  const { clearError, error, messages, sendMessage, setMessages, status, stop } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
    onError: (nextError) => {
      setGenerationError(nextError.message || 'Diagram generation failed before validation.');
    },
    onFinish: ({ message }) => {
      for (const part of message.parts) {
        const output = getSubmissionOutput(part);
        if (!output?.accepted || !output.source) continue;
        const plan = visualPlanSchema.safeParse(output.plan);
        setAcceptedPlan(plan.success ? plan.data : undefined);
        if (appliedSources.current.has(output.source)) continue;
        appliedSources.current.add(output.source);
        setSource(output.source);
        setAcceptedSource(output.source);
        setSourceDiagnostics([]);
        setRevisions((current) => appendRevision(current, output.source!));
        editingRevision.current = false;
        setGenerationError('');
      }
    },
  });
  const busy = status === 'submitted' || status === 'streaming';

  useEffect(() => {
    if (restoredDraft.current) return;
    restoredDraft.current = true;
    const draft = readStudioDraft(window.localStorage);
    if (draft) {
      // Browser storage is an external session snapshot and must be restored after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSource(draft.source);
      setAcceptedSource(draft.acceptedSource);
      setAcceptedPlan(draft.acceptedPlan);
      setInput(draft.input);
      setThemeName(draft.theme);
      setMessages(draft.messages);
      setRevisions({ entries: draft.revisions, index: draft.revisionIndex });
      setSidebarWidth(clampStudioSidebarWidth(draft.sidebarWidth));
      appliedSources.current.add(draft.acceptedSource);
    }
    setStorageReady(true);
  }, [setMessages]);

  useEffect(() => {
    if (!storageReady || busy) return;
    writeStudioDraft(window.localStorage, {
      version: 1,
      source,
      acceptedSource,
      acceptedPlan,
      input,
      theme: themeName,
      messages: messages.slice(-40),
      revisions: revisions.entries,
      revisionIndex: revisions.index,
      sidebarWidth,
    });
  }, [acceptedPlan, acceptedSource, busy, input, messages, revisions, sidebarWidth, source, storageReady, themeName]);

  useEffect(() => {
    if (messages.length === 0 && status !== 'streaming') return;
    messagesEndRef.current?.scrollIntoView({ block: 'end', behavior: status === 'streaming' ? 'auto' : 'smooth' });
  }, [messages, status]);

  useEffect(() => {
    if (!exportNotice) return;
    const timeout = window.setTimeout(() => setExportNotice(''), 2400);
    return () => window.clearTimeout(timeout);
  }, [exportNotice]);

  useEffect(() => {
    if (!sourceCopyNotice) return;
    const timeout = window.setTimeout(() => setSourceCopyNotice(''), 1800);
    return () => window.clearTimeout(timeout);
  }, [sourceCopyNotice]);

  useEffect(() => {
    if (source === acceptedSource) return;
    const timeout = window.setTimeout(() => {
      const nextCompilation = render(source, { theme, width: STUDIO_CANVAS_WIDTH });
      setSourceDiagnostics(nextCompilation.diagnostics);
      if (nextCompilation.svg && !nextCompilation.diagnostics.some(({ severity }) => severity === 'error')) {
        const isExistingManualRevision = editingRevision.current;
        setAcceptedSource(source);
        setAcceptedPlan(undefined);
        setRevisions((current) => isExistingManualRevision
          ? replaceCurrentRevision(current, source)
          : appendRevision(current, source));
        editingRevision.current = true;
      }
    }, 220);
    return () => window.clearTimeout(timeout);
  }, [acceptedSource, source, theme]);

  const fitCanvas = useCallback(() => {
    const stage = canvasStageRef.current;
    if (!stage) return;
    const zoom = calculateStudioFitZoom(
      { width: stage.clientWidth, height: stage.clientHeight },
      contentSize,
    );
    setViewport({ mode: 'fit', zoom });
  }, [contentSize]);

  useEffect(() => {
    const stage = canvasStageRef.current;
    const natural = visualNaturalRef.current;
    if (!stage) return;
    const measure = () => {
      if (natural) {
        const width = natural.offsetWidth || STUDIO_CANVAS_WIDTH;
        const height = natural.offsetHeight || 540;
        setContentSize((current) => current.width === width && current.height === height ? current : { width, height });
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    if (natural) observer.observe(natural);
    return () => observer.disconnect();
  }, [acceptedSource, hasScene, themeName]);

  useEffect(() => {
    if (viewport.mode === 'fit') fitCanvas();
  }, [contentSize, fitCanvas, isFullscreen, sidebarWidth, viewport.mode]);

  useEffect(() => {
    const updateFullscreen = () => setIsFullscreen(document.fullscreenElement === canvasPanelRef.current);
    document.addEventListener('fullscreenchange', updateFullscreen);
    return () => document.removeEventListener('fullscreenchange', updateFullscreen);
  }, []);

  const updateSource = (nextSource: string) => {
    setSource(nextSource);
    setAcceptedPlan((current) => retainVisualPlanForSource(current, nextSource, acceptedSource));
    if (nextSource === acceptedSource) setSourceDiagnostics([]);
  };

  const restoreRevision = (delta: -1 | 1) => {
    if (busy) return;
    const next = moveRevision(revisions, delta);
    if (next.index === revisions.index) return;
    const nextSource = next.entries[next.index] ?? '';
    setRevisions(next);
    setSource(nextSource);
    setAcceptedSource(nextSource);
    setAcceptedPlan(undefined);
    setSourceDiagnostics([]);
    appliedSources.current.add(nextSource);
    editingRevision.current = false;
    setGenerationError('');
    if (viewport.mode === 'fit') window.requestAnimationFrame(fitCanvas);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setGenerationError('');
    setInput('');
    void sendMessage({ text }, { body: { currentSource: acceptedSource, currentPlan: acceptedPlan, theme: themeName } });
  };

  const startNewDiagram = () => {
    if (busy) return;
    clearStudioDraft(window.localStorage);
    appliedSources.current = new Set([initialSource]);
    setMessages([]);
    setSource(initialSource);
    setAcceptedSource(initialSource);
    setAcceptedPlan(undefined);
    setSourceDiagnostics([]);
    setRevisions(createRevisionState(initialSource));
    editingRevision.current = false;
    setInput('');
    setActiveTab('chat');
    setViewport({ mode: 'fit', zoom: 1 });
    setGenerationError('');
    setExportNotice('');
    clearError();
  };

  const applyExample = (example: StudioExample) => {
    if (busy) return;
    setMessages([]);
    setInput('');
    setSource(example.source);
    setAcceptedSource(example.source);
    setAcceptedPlan(undefined);
    setSourceDiagnostics([]);
    setRevisions(createRevisionState(example.source));
    appliedSources.current = new Set([example.source]);
    editingRevision.current = false;
    setGenerationError('');
    setViewport({ mode: 'fit', zoom: 1 });
    setPendingExample(undefined);
    clearError();
  };

  const openExample = (example: StudioExample) => {
    const hasWork = hasScene || messages.length > 0 || input.trim().length > 0;
    if (hasWork) {
      setPendingExample(example);
      return;
    }
    applyExample(example);
  };

  const resizeSidebar = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (window.matchMedia('(max-width: 850px)').matches) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = sidebarWidth;
    const move = (nextEvent: PointerEvent) => {
      const viewportMaximum = Math.max(STUDIO_SIDEBAR_MIN, Math.min(STUDIO_SIDEBAR_MAX, window.innerWidth / 2));
      setSidebarWidth(Math.round(Math.max(STUDIO_SIDEBAR_MIN, Math.min(viewportMaximum, startWidth + nextEvent.clientX - startX))));
    };
    const stopResize = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stopResize);
      document.body.classList.remove('studio-is-resizing');
    };
    document.body.classList.add('studio-is-resizing');
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stopResize, { once: true });
  };

  const changeZoom = (delta: number) => {
    setViewport((current) => ({ mode: 'manual', zoom: clampStudioZoom(current.zoom + delta) }));
  };

  const toggleFullscreen = useCallback(async () => {
    const panel = canvasPanelRef.current;
    if (!panel || !document.fullscreenEnabled) return;
    try {
      if (document.fullscreenElement === panel) await document.exitFullscreen();
      else await panel.requestFullscreen();
    } catch {
      setExportNotice('Fullscreen unavailable');
    }
  }, []);

  const beginCanvasPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || event.target !== event.currentTarget) return;
    const stage = event.currentTarget;
    dragState.current = { x: event.clientX, y: event.clientY, left: stage.scrollLeft, top: stage.scrollTop };
    stage.setPointerCapture(event.pointerId);
    stage.classList.add('is-panning');
  };

  const continueCanvasPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragState.current;
    if (!drag) return;
    event.currentTarget.scrollLeft = drag.left - (event.clientX - drag.x);
    event.currentTarget.scrollTop = drag.top - (event.clientY - drag.y);
  };

  const endCanvasPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragState.current = undefined;
    event.currentTarget.classList.remove('is-panning');
  };

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = Boolean(target?.closest('input, textarea, [contenteditable="true"], .cm-editor'));
      if (event.key === 'Escape' && pendingExample) {
        event.preventDefault();
        setPendingExample(undefined);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && ['1', '2', '3'].includes(event.key)) {
        event.preventDefault();
        setActiveTab((['chat', 'source', 'examples'] as StudioSidebarTab[])[Number(event.key) - 1]!);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && activeTab === 'chat') {
        event.preventDefault();
        composerFormRef.current?.requestSubmit();
        return;
      }
      if (typing) return;
      if (event.altKey && event.key === 'ArrowLeft') { event.preventDefault(); restoreRevision(-1); return; }
      if (event.altKey && event.key === 'ArrowRight') { event.preventDefault(); restoreRevision(1); return; }
      if (event.key === '0') { event.preventDefault(); fitCanvas(); return; }
      if (event.key === '-' || event.key === '_') { event.preventDefault(); changeZoom(-STUDIO_ZOOM_STEP); return; }
      if (event.key === '+' || event.key === '=') { event.preventDefault(); changeZoom(STUDIO_ZOOM_STEP); return; }
      if (event.key.toLowerCase() === 'f') { event.preventDefault(); void toggleFullscreen(); }
    };
    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  });

  const exportDiagram = async (format: 'copy' | 'png' | 'svg') => {
    const svg = canvasPanelRef.current?.querySelector<SVGSVGElement>('.livery-chat-visual-renderer svg');
    if (!svg) {
      setExportNotice('Nothing to export yet');
      return;
    }
    try {
      const prepared = prepareExportSvg(svg);
      if (format === 'svg') {
        downloadBlob(prepared.blob, 'livery-diagram.svg');
        setExportNotice('SVG downloaded');
        return;
      }
      const png = await svgToPngBlob(prepared);
      if (format === 'png') {
        downloadBlob(png, 'livery-diagram.png');
        setExportNotice('PNG downloaded');
        return;
      }
      if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error('Image clipboard is unavailable');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
      setExportNotice('Image copied');
    } catch {
      setExportNotice(format === 'copy' ? 'Could not copy image' : 'Could not export image');
    }
  };

  const copySource = async () => {
    if (!source.trim()) {
      setSourceCopyNotice('Nothing to copy');
      return;
    }
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Text clipboard is unavailable');
      await navigator.clipboard.writeText(source);
      setSourceCopyNotice('Copied');
    } catch {
      setSourceCopyNotice('Copy failed');
    }
  };

  const onTabKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const tabs: StudioSidebarTab[] = ['chat', 'source', 'examples'];
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const next = tabs[(tabs.indexOf(activeTab) + direction + tabs.length) % tabs.length]!;
    setActiveTab(next);
    window.requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`[data-studio-tab="${next}"]`)?.focus());
  };

  const shellStyle = { '--studio-sidebar-width': `${sidebarWidth}px` } as CSSProperties;
  const visualSpaceStyle = { width: contentSize.width * viewport.zoom, height: contentSize.height * viewport.zoom };
  const visualTransformStyle = { width: contentSize.width, transform: `scale(${viewport.zoom})` };

  return (
    <main className="studio-shell" data-theme={themeName} style={shellStyle}>
      <header className="studio-header">
        <Link className="studio-brand" href="/" aria-label="Livery home">
          <span aria-hidden className="studio-brand-mark"><i /><i /><i /><i /></span>
          <strong>Livery</strong><span>Studio</span>
        </Link>
        <nav className="studio-header-nav" aria-label="Studio navigation">
          <Link href="/docs">Docs</Link>
          <a href="https://github.com/jerkeyray/livery" rel="noreferrer" target="_blank">GitHub</a>
          <SiteThemeToggle className="studio-site-theme-toggle" />
        </nav>
      </header>

      <section className="studio-sidebar" aria-label="Studio workbench">
        <div className="studio-sidebar-tabs" aria-label="Workbench panels" role="tablist">
          {(['chat', 'source', 'examples'] as StudioSidebarTab[]).map((tab, index) => (
            <button
              aria-controls={`studio-${tab}-panel`}
              aria-selected={activeTab === tab}
              data-studio-tab={tab}
              id={`studio-${tab}-tab`}
              key={tab}
              onClick={() => setActiveTab(tab)}
              onKeyDown={onTabKeyDown}
              role="tab"
              title={`${tab[0]!.toUpperCase()}${tab.slice(1)} (⌘${index + 1})`}
              type="button"
            >{tab}</button>
          ))}
        </div>

        {activeTab === 'chat' && (
          <div className="studio-sidebar-panel studio-chat-panel" id="studio-chat-panel" role="tabpanel" aria-labelledby="studio-chat-tab">
            <div className="studio-messages" aria-live="polite">
              {messages.length === 0 && (
                <div className="studio-chat-heading">
                  <h1>Describe the system.<br />Shape it together.</h1>
                  <p>Ask for a technical visual, then refine it in plain language. Every revision is compiled before it reaches the canvas.</p>
                </div>
              )}
              <div className="studio-message-list">
                {messages.length === 0 ? (
                  <div className="studio-empty-chat">
                    <span>Need a starting point?</span>
                    <button onClick={() => setActiveTab('examples')} type="button">
                      <span><strong>Browse proven examples</strong><small>Open source instantly, without a model call</small></span>
                      <b aria-hidden>→</b>
                    </button>
                  </div>
                ) : messages.map((message) => <ChatMessage key={message.id} message={message} />)}
                {busy && <div className="studio-agent-progress"><span /><span /><span /><em>Drafting and checking</em></div>}
                {(generationError || error) && <div className="studio-chat-error" role="alert">{generationError || error?.message || 'Generation failed. Check the API key and try again.'}</div>}
                <div ref={messagesEndRef} aria-hidden />
              </div>
            </div>

            <form className="studio-composer" onSubmit={submit} ref={composerFormRef}>
              <textarea aria-label="Diagram request" disabled={busy} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }} placeholder="Describe a system, workflow, or idea…" rows={3} value={input} />
              <div>{busy ? <button className="studio-stop-button" onClick={stop} type="button">Stop</button> : <button disabled={!input.trim()} type="submit">Generate <b aria-hidden>→</b></button>}</div>
            </form>
          </div>
        )}

        {activeTab === 'source' && (
          <div className="studio-sidebar-panel studio-source-panel" id="studio-source-panel" role="tabpanel" aria-labelledby="studio-source-tab">
            <div className="studio-source-heading">
              <div><span className="studio-eyebrow">Editable source</span><strong>scene.livery</strong></div>
              <div className="studio-source-actions">
                <span aria-live="polite" data-status={sourceCopyNotice === 'Copied' ? 'success' : sourceCopyNotice === 'Copy failed' ? 'error' : 'neutral'}>{sourceCopyNotice}</span>
                <button className="studio-source-copy" onClick={() => void copySource()} type="button">Copy</button>
              </div>
            </div>
            <LiverySourceEditor diagnostics={sourceDiagnostics} onChange={updateSource} ref={sourceEditorRef} source={source} />
            <Diagnostics diagnostics={sourceDiagnostics} onSelect={(diagnostic) => sourceEditorRef.current?.focusDiagnostic(diagnostic)} />
          </div>
        )}

        {activeTab === 'examples' && (
          <div className="studio-sidebar-panel studio-examples-panel" id="studio-examples-panel" role="tabpanel" aria-labelledby="studio-examples-tab">
            <div className="studio-examples-heading"><span className="studio-eyebrow">Compiler proven</span><h1>Example gallery</h1><p>Open a complete Livery program instantly, then inspect or reshape it.</p></div>
            <div className="studio-example-groups">
              {Array.from(new Set(studioExamples.map(({ family }) => family))).map((family) => (
                <section key={family}>
                  <h2>{family}</h2>
                  {studioExamples.filter((example) => example.family === family).map((example) => (
                    <button key={example.id} onClick={() => openExample(example)} type="button">
                      <span><strong>{example.title}</strong><small>{example.description}</small></span><b aria-hidden>Open</b>
                    </button>
                  ))}
                </section>
              ))}
            </div>
          </div>
        )}
      </section>

      <div
        aria-label="Resize Studio sidebar"
        aria-orientation="vertical"
        aria-valuemax={STUDIO_SIDEBAR_MAX}
        aria-valuemin={STUDIO_SIDEBAR_MIN}
        aria-valuenow={sidebarWidth}
        className="studio-sidebar-resizer"
        onDoubleClick={() => setSidebarWidth(STUDIO_SIDEBAR_DEFAULT)}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
          event.preventDefault();
          const step = event.shiftKey ? 48 : 16;
          setSidebarWidth((current) => clampStudioSidebarWidth(current + (event.key === 'ArrowRight' ? step : -step)));
        }}
        onPointerDown={resizeSidebar}
        role="separator"
        tabIndex={0}
        title="Drag to resize · double-click to reset"
      />

      <section className="studio-canvas-panel" aria-label="Compiled diagram" data-theme={themeName} ref={canvasPanelRef}>
        <div className="studio-canvas-toolbar">
          <div className="studio-toolbar-primary">
            {(hasScene || messages.length > 0 || input.length > 0) && (
              <button className="studio-new-button" disabled={busy} onClick={startNewDiagram} type="button"><b aria-hidden>+</b><span>New</span></button>
            )}
            {hasScene && (
              <div className={`studio-revision-controls${revisions.entries.length <= 1 ? ' is-placeholder' : ''}`} aria-hidden={revisions.entries.length <= 1} aria-label="Diagram revisions">
                <button aria-label="Previous revision" disabled={busy || revisions.index === 0} onClick={() => restoreRevision(-1)} title="Previous revision" type="button">←</button>
                <span aria-live="polite">{revisions.index + 1}/{revisions.entries.length}</span>
                <button aria-label="Next revision" disabled={busy || revisions.index === revisions.entries.length - 1} onClick={() => restoreRevision(1)} title="Next revision" type="button">→</button>
              </div>
            )}
          </div>
          <span aria-live="polite" className="studio-export-notice">{exportNotice}</span>
          <div className="studio-canvas-actions">
            <ThemePicker onChange={setThemeName} value={themeName} />
            {hasScene && <ExportMenu onExport={exportDiagram} />}
          </div>
        </div>
        <div
          className="studio-canvas-stage"
          onPointerCancel={endCanvasPan}
          onPointerDown={beginCanvasPan}
          onPointerMove={continueCanvasPan}
          onPointerUp={endCanvasPan}
          ref={canvasStageRef}
        >
          {hasScene ? (
            <div className="studio-canvas-content-space" style={visualSpaceStyle}>
              <div className="studio-visual-natural" ref={visualNaturalRef} style={visualTransformStyle}>
                <LiveryChatVisual
                  compileDelay={0}
                  fallback={<div className="studio-visual-fallback">The current source needs repair.</div>}
                  source={acceptedSource}
                  streaming={busy}
                  theme={theme}
                  timelineControls="auto"
                  width={STUDIO_CANVAS_WIDTH}
                />
              </div>
            </div>
          ) : (
            <div className="studio-canvas-empty">
              <span aria-hidden className="studio-brand-mark studio-canvas-empty-logo"><i /><i /><i /><i /></span>
              <strong>Your visual starts here</strong>
              <p>Describe a system or open a proven example.</p>
              <button onClick={() => setActiveTab('examples')} type="button">Browse examples</button>
            </div>
          )}
        </div>
        <div className="studio-viewport-controls" aria-label="Canvas view controls">
          <button aria-label="Fit diagram" onClick={fitCanvas} title="Fit diagram (0)" type="button">Fit</button>
          <button aria-label="Zoom out" disabled={viewport.zoom <= 0.25} onClick={() => changeZoom(-STUDIO_ZOOM_STEP)} title="Zoom out (-)" type="button">−</button>
          <button aria-label="Reset zoom to 100%" className="studio-zoom-value" onClick={() => setViewport({ mode: 'manual', zoom: 1 })} title="Reset zoom to 100%" type="button">{Math.round(viewport.zoom * 100)}%</button>
          <button aria-label="Zoom in" disabled={viewport.zoom >= 2} onClick={() => changeZoom(STUDIO_ZOOM_STEP)} title="Zoom in (+)" type="button">+</button>
          <button aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} disabled={typeof document !== 'undefined' && !document.fullscreenEnabled} onClick={() => void toggleFullscreen()} title="Toggle fullscreen (F)" type="button">{isFullscreen ? '↙' : '↗'}</button>
        </div>
      </section>

      {pendingExample && (
        <div className="studio-dialog-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setPendingExample(undefined);
        }}>
          <div aria-describedby="studio-example-confirm-description" aria-labelledby="studio-example-confirm-title" aria-modal="true" className="studio-dialog" role="dialog">
            <span className="studio-eyebrow">Replace current work</span>
            <h2 id="studio-example-confirm-title">Open {pendingExample.title}?</h2>
            <p id="studio-example-confirm-description">This replaces the current chat and revision history with the selected example.</p>
            <div>
              <button autoFocus className="studio-dialog-cancel" onClick={() => setPendingExample(undefined)} type="button">Cancel</button>
              <button className="studio-dialog-confirm" onClick={() => applyExample(pendingExample)} type="button">Open example</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function ThemePicker({ onChange, value }: { onChange: (theme: BuiltInThemeName) => void; value: BuiltInThemeName }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const label = themeOptions.find(([name]) => name === value)?.[1] ?? 'Editorial';

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        rootRef.current?.querySelector<HTMLButtonElement>('.studio-theme-trigger')?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <div className="studio-theme-picker" ref={rootRef}>
      <button
        aria-controls="studio-theme-menu"
        aria-expanded={open}
        aria-haspopup="listbox"
        className="studio-theme-trigger"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span>{label}</span><i aria-hidden />
      </button>
      {open && (
        <div aria-label="Canvas theme" className="studio-theme-menu" id="studio-theme-menu" role="listbox">
          {themeOptions.map(([name, optionLabel]) => (
            <button
              aria-selected={name === value}
              className={name === value ? 'is-selected' : undefined}
              key={name}
              onClick={() => { onChange(name); setOpen(false); }}
              role="option"
              type="button"
            >
              <span>{optionLabel}</span>{name === value && <i aria-hidden>✓</i>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ExportMenu({ onExport }: { onExport: (format: 'copy' | 'png' | 'svg') => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        rootRef.current?.querySelector<HTMLButtonElement>('.studio-export-trigger')?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const run = (format: 'copy' | 'png' | 'svg') => {
    setOpen(false);
    void onExport(format);
  };

  return (
    <div className="studio-export-picker" ref={rootRef}>
      <button aria-controls="studio-export-menu" aria-expanded={open} aria-haspopup="menu" className="studio-export-trigger" onClick={() => setOpen((current) => !current)} type="button">
        <span>Export</span><i aria-hidden />
      </button>
      {open && (
        <div aria-label="Export diagram" className="studio-export-menu" id="studio-export-menu" role="menu">
          <button onClick={() => run('copy')} role="menuitem" type="button"><span>Copy image</span><small>PNG</small></button>
          <button onClick={() => run('png')} role="menuitem" type="button"><span>Download image</span><small>PNG</small></button>
          <button onClick={() => run('svg')} role="menuitem" type="button"><span>Download vector</span><small>SVG</small></button>
        </div>
      )}
    </div>
  );
}

type PreparedSvg = { blob: Blob; width: number; height: number };

function prepareExportSvg(svg: SVGSVGElement): PreparedSvg {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const bounds = visualContentBounds(svg);
  const originalViewBox = svg.viewBox.baseVal;
  const padding = 24;
  const x = bounds ? bounds.x - padding : originalViewBox.x;
  const y = 0;
  const width = bounds ? bounds.width + padding * 2 : originalViewBox.width || Number(svg.getAttribute('width')) || 1200;
  const height = bounds ? bounds.y + bounds.height + padding : originalViewBox.height || Number(svg.getAttribute('height')) || 800;
  const visibleTitle = Array.from(clone.children).find((element) => element.tagName.toLowerCase() === 'text');
  visibleTitle?.setAttribute('x', String(x + padding));
  const background = Array.from(clone.children).find((element) => element.tagName.toLowerCase() === 'rect');
  if (background) {
    background.setAttribute('x', String(x));
    background.setAttribute('y', String(y));
    background.setAttribute('width', String(width));
    background.setAttribute('height', String(height));
  }
  clone.setAttribute('viewBox', `${x} ${y} ${width} ${height}`);
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  return {
    blob: new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' }),
    width,
    height,
  };
}

function visualContentBounds(svg: SVGSVGElement): { x: number; y: number; width: number; height: number } | undefined {
  const elements = svg.querySelectorAll<SVGGraphicsElement>('g[data-livery-id], g[data-livery-connector]');
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const element of elements) {
    const matrix = element.getCTM();
    if (!matrix) continue;
    const box = element.getBBox();
    for (const [pointX, pointY] of [[box.x, box.y], [box.x + box.width, box.y], [box.x, box.y + box.height], [box.x + box.width, box.y + box.height]]) {
      const x = matrix.a * pointX + matrix.c * pointY + matrix.e;
      const y = matrix.b * pointX + matrix.d * pointY + matrix.f;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return Number.isFinite(minX) ? { x: minX, y: minY, width: maxX - minX, height: maxY - minY } : undefined;
}

async function svgToPngBlob(svg: PreparedSvg): Promise<Blob> {
  const { width, height } = svg;
  const scale = Math.min(2, 4096 / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const url = URL.createObjectURL(svg.blob);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Could not render SVG'));
      image.src = url;
    });
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is unavailable');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not encode PNG')), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function ChatMessage({ message }: { message: UIMessage }) {
  const text = message.parts.filter((part) => part.type === 'text').map((part) => part.text).join('');
  const submissions = message.parts.map(getSubmissionOutput).filter((output): output is SubmissionOutput => Boolean(output));
  const accepted = submissions.findLast((output) => output.accepted);
  const lastRejected = submissions.findLast((output) => !output.accepted);
  const rejectedSubmissions = submissions.filter((output) => !output.accepted);
  const rejected = rejectedSubmissions.length;
  const [expanded, setExpanded] = useState(false);
  const rejectionText = lastRejected?.diagnostics?.length
    ? `Could not apply the diagram: ${lastRejected.diagnostics.map(({ message }) => message).join(' ')}`
    : 'Could not produce a valid diagram within the repair limit.';
  const displayText = accepted?.summary || text || (message.role === 'assistant' && lastRejected ? rejectionText : '');
  const collapsible = message.role === 'user' && displayText.length > 260;

  return (
    <article className={`studio-message studio-message-${message.role}`}>
      <span>{message.role === 'user' ? 'You' : 'Livery'}</span>
      {displayText && (
        <div className={`studio-message-bubble${collapsible ? ' studio-message-bubble-collapsible' : ''}${expanded ? ' is-expanded' : ''}`}>
          <p className={collapsible && !expanded ? 'studio-message-copy-collapsed' : undefined}>{displayText}</p>
          {collapsible && (
            <button
              aria-expanded={expanded}
              className="studio-message-toggle"
              onClick={() => setExpanded((value) => !value)}
              type="button"
            >
              {expanded ? 'Less' : 'More'} <i aria-hidden />
            </button>
          )}
        </div>
      )}
      {rejected > 0 && (
        <details className="studio-validation-log">
          <summary>{rejected} rejected validation {rejected === 1 ? 'attempt' : 'attempts'}</summary>
          <ol>
            {rejectedSubmissions.map((submission, attempt) => (
              <li key={attempt}>
                <strong>Attempt {attempt + 1}</strong>
                {(submission.diagnostics?.length ? submission.diagnostics : [{ code: 'generation.rejected', message: 'The revision was rejected without a diagnostic.' }]).map(({ code, message }, diagnostic) => (
                  <span key={`${code}-${diagnostic}`}><code>{code}</code>{message}</span>
                ))}
              </li>
            ))}
          </ol>
        </details>
      )}
      {accepted && <small className="studio-accepted-revision"><i />Compiled and applied</small>}
    </article>
  );
}

function getSubmissionOutput(part: UIMessage['parts'][number]): SubmissionOutput | undefined {
  if (!['tool-submit_livery', 'tool-submit_livery_plan'].includes(part.type) || !('state' in part) || part.state !== 'output-available') return undefined;
  return part.output as SubmissionOutput;
}

function Diagnostics({ diagnostics, onSelect }: { diagnostics: Diagnostic[]; onSelect: (diagnostic: Diagnostic) => void }) {
  if (diagnostics.length === 0) return <div className="studio-diagnostic-ready"><i />Ready to render</div>;
  return (
    <div className="studio-diagnostics">
      {diagnostics.slice(0, 4).map((diagnostic, index) => (
        <button key={`${diagnostic.code}-${index}`} onClick={() => onSelect(diagnostic)} type="button">
          <strong>{diagnostic.code}</strong><span>{diagnostic.message}</span>
        </button>
      ))}
    </div>
  );
}
