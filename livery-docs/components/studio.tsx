'use client';

import { useChat } from '@ai-sdk/react';
import { getBuiltInTheme, render, type BuiltInThemeName, type Diagnostic } from '@jerkeyray/core';
import { LiveryChatVisual } from '@jerkeyray/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';

const initialSource = '';

const prompts = [
  'Show a browser request moving through an API, queue, worker, and Postgres.',
  'Create a research agent that uses search and a reasoning model.',
  'Draw checkout authorization with approved and declined states.',
  'Explain a deployment pipeline from commit to production.',
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
  const errors = diagnostics.filter(({ severity }) => severity === 'error');

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
              {prompts.map((prompt) => <button key={prompt} onClick={() => runPrompt(prompt)} type="button">{prompt}<b aria-hidden>↗</b></button>)}
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
          <div><span>Enter to send · Shift + Enter for newline</span>{busy ? <button className="studio-stop-button" onClick={stop} type="button">Stop</button> : <button disabled={!input.trim()} type="submit">Generate <b aria-hidden>→</b></button>}</div>
        </form>
      </section>

      <section className="studio-canvas-panel" aria-label="Compiled diagram">
        <div className="studio-canvas-toolbar">
          <div><span className="studio-eyebrow">Live canvas</span><strong>{!hasScene ? 'Ready for a prompt' : errors.length ? 'Keeping last valid scene' : 'Compiled successfully'}</strong></div>
          <div className="studio-canvas-actions">
            <label className="studio-theme-picker">
              <span>Theme</span>
              <select aria-label="Canvas theme" onChange={(event) => setThemeName(event.target.value as BuiltInThemeName)} value={themeName}>
                <option value="editorial">Editorial</option>
                <option value="paper">Paper</option>
                <option value="midnight">Midnight</option>
              </select>
              <i aria-hidden />
            </label>
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
              width={760}
            />
          ) : (
            <div className="studio-canvas-empty">
              <div aria-hidden className="studio-canvas-empty-mark"><i /><i /><i /><i /></div>
              <strong>Your visual starts here</strong>
              <p>Describe a system or choose a starting point.</p>
            </div>
          )}
        </div>
        {hasScene && <div className="studio-canvas-caption"><span>VALIDATED OUTPUT</span><p>The canvas only changes after the Livery compiler accepts a complete revision.</p></div>}
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
