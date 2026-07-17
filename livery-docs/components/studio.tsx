'use client';

import { useChat } from '@ai-sdk/react';
import { getBuiltInTheme, render, type BuiltInThemeName, type Diagnostic } from '@jerkeyray/core';
import { LiveryChatVisual } from '@jerkeyray/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { STUDIO_CANVAS_WIDTH } from '@/lib/studio-agent';
import { readStudioDraft, writeStudioDraft } from '@/lib/studio-storage';

const initialSource = '';

const themeOptions = [
  ['editorial', 'Editorial'],
  ['paper', 'Paper'],
  ['midnight', 'Midnight'],
  ['blackout', 'Blackout'],
  ['blueprint', 'Blueprint'],
  ['monochrome', 'Monochrome'],
] as const satisfies ReadonlyArray<readonly [BuiltInThemeName, string]>;

const prompts = [
  {
    title: 'Production checkout',
    description: 'Services, payment, queue, workers, and data',
    prompt: 'Design a production checkout architecture. Group it into four sibling frames: Client contains Browser; Commerce contains Checkout API and Stripe; Async processing contains Queue and Fulfillment worker; Data contains Postgres. Do not nest these frames. Show Browser calling Checkout API, Checkout API authorizing Stripe and writing Postgres, Checkout API publishing an order event to Queue, and Queue dispatching Fulfillment worker. Use a native flow layout with the customer-to-worker path marked primary and payment and storage marked supporting. Keep labels concise and color restrained.',
  },
  {
    title: 'Research agent loop',
    description: 'Model, tools, memory, evaluation, and citations',
    prompt: 'Create an AI research agent workflow. Show a user request entering a planner, a reasoning model deciding when to call web search and document retrieval tools, useful findings being stored in working memory, an evaluator checking evidence quality, and a final answer with citations returning to the user. Make the iterative tool loop clear without crossing connectors.',
  },
  {
    title: 'Realtime data platform',
    description: 'Events from ingestion to warehouse and dashboard',
    prompt: 'Explain a realtime analytics platform from event ingestion to insight. Show product events entering an API, flowing into Kafka, being cleaned by a stream processor, written to a warehouse, transformed into metrics, and read by a live operations dashboard. Use one continuous top-to-bottom reading order. Stack the labeled Ingestion, Processing, Storage, and Consumption frames vertically; do not arrange sequential stages in a 2×2 grid. Keep each frame compact, use short connector labels, and distinguish streaming paths from stored-data reads.',
  },
  {
    title: 'Safe deployment',
    description: 'CI, canary release, observability, and rollback',
    prompt: 'Visualize a safe deployment pipeline from commit to production. Show a developer commit triggering CI tests, an artifact build, staging verification, a canary deployment, health and error-rate checks, then either promotion to production or automatic rollback. Do not put every step in one tall frame. Use separate compact Build, Release, and Decision stages arranged as short rows, with a clearly visible split from health checks to promotion or rollback. Use success, warning, and danger tones only where they communicate release state.',
  },
];

type SubmissionOutput = {
  accepted: boolean;
  source?: string;
  summary?: string;
  diagnostics?: Array<{ code: string; message: string; severity?: string }>;
};

export function Studio() {
  const [input, setInput] = useState('');
  const [source, setSource] = useState(initialSource);
  const [acceptedSource, setAcceptedSource] = useState(initialSource);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [themeName, setThemeName] = useState<BuiltInThemeName>('editorial');
  const [generationError, setGenerationError] = useState('');
  const [exportNotice, setExportNotice] = useState('');
  const [storageReady, setStorageReady] = useState(false);
  const theme = getBuiltInTheme(themeName);
  const hasScene = acceptedSource.trim().length > 0;
  const appliedSources = useRef(new Set([initialSource]));
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const canvasPanelRef = useRef<HTMLElement>(null);
  const compilation = useMemo(() => source.trim() ? render(source, { theme, width: STUDIO_CANVAS_WIDTH }) : { diagnostics: [] }, [source, theme]);
  const diagnostics = compilation.diagnostics;

  const { error, messages, sendMessage, setMessages, status, stop } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
    onError: (nextError) => {
      setGenerationError(nextError.message || 'Diagram generation failed before validation.');
    },
    onFinish: ({ message }) => {
      for (const part of message.parts) {
        const output = getSubmissionOutput(part);
        if (!output?.accepted || !output.source || appliedSources.current.has(output.source)) continue;
        appliedSources.current.add(output.source);
        setSource(output.source);
        setAcceptedSource(output.source);
        setGenerationError('');
      }
    },
  });
  const busy = status === 'submitted' || status === 'streaming';

  useEffect(() => {
    const draft = readStudioDraft(window.localStorage);
    if (draft) {
      // Browser storage is an external session snapshot and must be restored after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSource(draft.source);
      setAcceptedSource(draft.acceptedSource);
      setInput(draft.input);
      setThemeName(draft.theme);
      setMessages(draft.messages);
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
      input,
      theme: themeName,
      messages: messages.slice(-40),
    });
  }, [acceptedSource, busy, input, messages, source, storageReady, themeName]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'end', behavior: status === 'streaming' ? 'auto' : 'smooth' });
  }, [messages, status]);

  useEffect(() => {
    if (!exportNotice) return;
    const timeout = window.setTimeout(() => setExportNotice(''), 2400);
    return () => window.clearTimeout(timeout);
  }, [exportNotice]);

  const updateSource = (nextSource: string) => {
    setSource(nextSource);
    const nextCompilation = render(nextSource, { theme, width: STUDIO_CANVAS_WIDTH });
    if (nextCompilation.svg && !nextCompilation.diagnostics.some(({ severity }) => severity === 'error')) {
      setAcceptedSource(nextSource);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setGenerationError('');
    setInput('');
    void sendMessage({ text }, { body: { currentSource: acceptedSource, theme: themeName } });
  };

  const runPrompt = (prompt: string) => {
    if (busy) return;
    setGenerationError('');
    void sendMessage({ text: prompt }, { body: { currentSource: acceptedSource, theme: themeName } });
  };

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

  return (
    <main className="studio-shell" data-theme={themeName}>
      <header className="studio-header">
        <Link className="studio-brand" href="/" aria-label="Livery home">
          <span aria-hidden className="studio-brand-mark"><i /><i /><i /><i /></span>
          <strong>Livery</strong><span>Studio</span>
        </Link>
        <nav className="studio-header-nav" aria-label="Studio navigation">
          <Link href="/docs">Docs</Link>
          <a href="https://github.com/jerkeyray/livery" rel="noreferrer" target="_blank">GitHub</a>
        </nav>
      </header>

      <section className="studio-chat-panel" aria-label="Diagram conversation">
        <div className="studio-chat-heading">
          <span className="studio-eyebrow">Livery Studio</span>
          <h1>Describe the system.<br />Shape it together.</h1>
          <p>Ask for a technical visual, then refine it in plain language. Every revision is compiled before it reaches the canvas.</p>
        </div>

        <div className="studio-messages" aria-live="polite">
          {messages.length === 0 ? (
            <div className="studio-empty-chat">
              <span>Try a starting point</span>
              {prompts.map(({ title, description, prompt }) => (
                <button key={title} onClick={() => runPrompt(prompt)} type="button">
                  <span><strong>{title}</strong><small>{description}</small></span>
                  <b aria-hidden>↗</b>
                </button>
              ))}
            </div>
          ) : messages.map((message) => <ChatMessage key={message.id} message={message} />)}
          {busy && <div className="studio-agent-progress"><span /><span /><span /><em>Drafting and checking</em></div>}
          {(generationError || error) && <div className="studio-chat-error" role="alert">{generationError || error?.message || 'Generation failed. Check the API key and try again.'}</div>}
          <div ref={messagesEndRef} aria-hidden />
        </div>

        <form className="studio-composer" onSubmit={submit}>
          <textarea aria-label="Diagram request" disabled={busy} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }} placeholder="Describe a system, workflow, or idea…" rows={3} value={input} />
          <div>{busy ? <button className="studio-stop-button" onClick={stop} type="button">Stop</button> : <button disabled={!input.trim()} type="submit">Generate <b aria-hidden>→</b></button>}</div>
        </form>
      </section>

      <section className="studio-canvas-panel" aria-label="Compiled diagram" data-theme={themeName} ref={canvasPanelRef}>
        <div className="studio-canvas-toolbar">
          <span aria-live="polite" className="studio-export-notice">{exportNotice}</span>
          <div className="studio-canvas-actions">
            <ThemePicker onChange={setThemeName} value={themeName} />
            {hasScene && <ExportMenu onExport={exportDiagram} />}
            <button aria-expanded={sourceOpen} onClick={() => setSourceOpen((value) => !value)} type="button">{sourceOpen ? 'Hide source' : 'View source'}</button>
          </div>
        </div>
        <div className="studio-canvas-stage">
          {hasScene ? (
            <LiveryChatVisual
              fallback={<div className="studio-visual-fallback">The current source needs repair.</div>}
              source={acceptedSource}
              streaming={busy}
              theme={theme}
              timelineControls="auto"
              width={STUDIO_CANVAS_WIDTH}
            />
          ) : (
            <div className="studio-canvas-empty">
              <span aria-hidden className="studio-brand-mark studio-canvas-empty-logo"><i /><i /><i /><i /></span>
              <strong>Your visual starts here</strong>
              <p>Describe a system or choose a starting point.</p>
            </div>
          )}
        </div>
      </section>

      {sourceOpen && (
        <aside className="studio-source-panel" aria-label="Livery source">
          <div className="studio-source-heading"><div><span className="studio-eyebrow">Source</span><strong>scene.livery</strong></div><button onClick={() => setSourceOpen(false)} type="button" aria-label="Close source">×</button></div>
          <textarea aria-label="Editable Livery source" onChange={(event) => updateSource(event.target.value)} spellCheck={false} value={source} />
          <Diagnostics diagnostics={diagnostics} />
        </aside>
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
  if (part.type !== 'tool-submit_livery' || !('state' in part) || part.state !== 'output-available') return undefined;
  return part.output as SubmissionOutput;
}

function Diagnostics({ diagnostics }: { diagnostics: Diagnostic[] }) {
  if (diagnostics.length === 0) return <div className="studio-diagnostic-ready"><i />Ready to render</div>;
  return (
    <div className="studio-diagnostics">
      {diagnostics.slice(0, 4).map((diagnostic, index) => (
        <div key={`${diagnostic.code}-${index}`}><strong>{diagnostic.code}</strong><span>{diagnostic.message}</span></div>
      ))}
    </div>
  );
}
