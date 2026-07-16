'use client';

import { useChat } from '@ai-sdk/react';
import { getBuiltInTheme, render, type BuiltInThemeName, type Diagnostic } from '@jerkeyray/core';
import { LiveryChatVisual } from '@jerkeyray/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';

const initialSource = '';

const prompts = [
  {
    title: 'Production checkout',
    description: 'Services, payment, queue, workers, and data',
    prompt: 'Design a production checkout architecture. Group it into Client, Commerce, Async processing, and Data. Show a customer browser calling a checkout API, the API authorizing payment with Stripe and writing an order to Postgres, then publishing to a queue consumed by a fulfillment worker. Represent the order event as the async connector label, not as a standalone node. Arrange Client, Commerce, and Async processing as one compact left-to-right row, with Data directly below Commerce. Keep frame sizes balanced, connector labels in the open gaps between frames, and use restrained color only for payment and success.',
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
  const theme = getBuiltInTheme(themeName);
  const hasScene = acceptedSource.trim().length > 0;
  const appliedSources = useRef(new Set([initialSource]));
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const compilation = useMemo(() => source.trim() ? render(source, { theme, width: 760 }) : { diagnostics: [] }, [source, theme]);
  const diagnostics = compilation.diagnostics;

  const { error, messages, sendMessage, status, stop } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
    onFinish: ({ message }) => {
      for (const part of message.parts) {
        const output = getSubmissionOutput(part);
        if (!output?.accepted || !output.source || appliedSources.current.has(output.source)) continue;
        appliedSources.current.add(output.source);
        setSource(output.source);
        setAcceptedSource(output.source);
      }
    },
  });
  const busy = status === 'submitted' || status === 'streaming';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'end', behavior: status === 'streaming' ? 'auto' : 'smooth' });
  }, [messages, status]);

  const updateSource = (nextSource: string) => {
    setSource(nextSource);
    const nextCompilation = render(nextSource, { theme, width: 760 });
    if (nextCompilation.svg && !nextCompilation.diagnostics.some(({ severity }) => severity === 'error')) {
      setAcceptedSource(nextSource);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    void sendMessage({ text }, { body: { currentSource: acceptedSource, theme: themeName } });
  };

  const runPrompt = (prompt: string) => {
    if (busy) return;
    void sendMessage({ text: prompt }, { body: { currentSource: acceptedSource, theme: themeName } });
  };

  return (
    <main className="studio-shell">
      <header className="studio-header">
        <Link className="studio-brand" href="/" aria-label="Livery home">
          <span aria-hidden className="studio-brand-mark"><i /><i /><i /><i /></span>
          <strong>Livery</strong><span>Studio</span>
        </Link>
      </header>

      <section className="studio-chat-panel" aria-label="Diagram conversation">
        <div className="studio-chat-heading">
          <span className="studio-eyebrow">Diagram agent</span>
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
          {error && <div className="studio-chat-error" role="alert">{error.message || 'Generation failed. Check the API key and try again.'}</div>}
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

      <section className="studio-canvas-panel" aria-label="Compiled diagram" data-theme={themeName}>
        <div className="studio-canvas-toolbar">
          <div className="studio-canvas-actions">
            <label className="studio-theme-picker">
              <select aria-label="Canvas theme" onChange={(event) => setThemeName(event.target.value as BuiltInThemeName)} value={themeName}>
                <option value="editorial">Editorial</option>
                <option value="paper">Paper</option>
                <option value="midnight">Midnight</option>
                <option value="blackout">Blackout</option>
                <option value="blueprint">Blueprint</option>
                <option value="monochrome">Monochrome</option>
              </select>
            </label>
            <button aria-expanded={sourceOpen} onClick={() => setSourceOpen((value) => !value)} type="button">{sourceOpen ? 'Hide source' : 'View source'}</button>
          </div>
        </div>
        <div className="studio-canvas-stage">
          {hasScene ? (
            <LiveryChatVisual
              fallback={<div className="studio-visual-fallback">The current source needs repair.</div>}
              key={themeName}
              source={acceptedSource}
              streaming={busy}
              theme={theme}
              timelineControls="auto"
              width={760}
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

function ChatMessage({ message }: { message: UIMessage }) {
  const text = message.parts.filter((part) => part.type === 'text').map((part) => part.text).join('');
  const submissions = message.parts.map(getSubmissionOutput).filter((output): output is SubmissionOutput => Boolean(output));
  const accepted = submissions.findLast((output) => output.accepted);
  const rejected = submissions.filter((output) => !output.accepted).length;
  const [expanded, setExpanded] = useState(false);
  const displayText = accepted?.summary ?? text;
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
      {rejected > 0 && <small>Repaired {rejected} validation {rejected === 1 ? 'issue' : 'issues'}</small>}
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
