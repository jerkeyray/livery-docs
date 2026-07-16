'use client';

import Image from 'next/image';
import { ArrowRight, Braces, Check } from 'lucide-react';
import { type KeyboardEvent, useRef, useState } from 'react';

const examples = [
  {
    name: 'agent trace',
    file: 'agent-trace.livery',
    image: '/agent-trace.svg',
    alt: 'Research agent connected to search and reasoning model',
    source: `figure agent_trace("Agent tool trace") {
  agent = lib.agent(label: "Research agent")
  search = lib.tool(label: "Search")
  model = lib.model(label: "Reasoning model")

  use_search = connect(agent.right, search.left,
    label: "query", variant: async)
  reason = connect(search.right, model.left,
    label: "evidence", variant: data)

  row(gap: xl) { agent search model }
}`,
  },
  {
    name: 'data flow',
    file: 'data-transform.livery',
    image: '/data-transform.svg',
    alt: 'Raw events normalized into clean records',
    source: `figure transform("Data transformation") {
  input = lib.table(label: "Raw events")
  worker = lib.worker(label: "Normalize")
  output = lib.table(label: "Clean records")

  ingest = connect(input.right, worker.left,
    label: "parse")
  emit = connect(worker.right, output.left,
    label: "validate")

  row(gap: xl) { input worker output }
}`,
  },
  {
    name: 'timeline',
    file: 'timeline.livery',
    image: '/timeline.svg',
    alt: 'Checkout API and payment authorization timeline',
    source: `figure checkout_state("Checkout state") {
  api = lib.service(label: "Checkout API")
  payment = lib.service(label: "Payment")
  authorize = connect(api.right, payment.left,
    label: "authorize")

  row(gap: xl) { api payment }
  timeline checkout {
    state request { show(api) }
    state authorization { show(payment) trace(authorize) }
  }
}`,
  },
];

export function HeroDemo() {
  const [active, setActive] = useState(0);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const example = examples[active];

  const advance = () => setActive((current) => (current + 1) % examples.length);

  const selectTab = (index: number) => {
    setActive(index);
    tabRefs.current[index]?.focus();
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index;

    if (event.key === 'ArrowRight') next = (index + 1) % examples.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + examples.length) % examples.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = examples.length - 1;
    else return;

    event.preventDefault();
    selectTab(next);
  };

  return (
    <div className="hero-workbench">
      <div className="workbench-chrome">
        <div className="workbench-tab"><Braces size={13} /> {example.file}</div>
        <div className="valid-state"><Check size={12} /> valid geometry</div>
      </div>
      <div className="example-switcher" role="tablist" aria-label="Livery examples">
        {examples.map((item, index) => (
          <button
            key={item.name}
            type="button"
            role="tab"
            id={`example-tab-${index}`}
            aria-controls="example-panel"
            aria-selected={active === index}
            tabIndex={active === index ? 0 : -1}
            ref={(node) => { tabRefs.current[index] = node; }}
            onClick={() => setActive(index)}
            onKeyDown={(event) => handleTabKeyDown(event, index)}
          >
            <span>0{index + 1}</span> {item.name}
          </button>
        ))}
      </div>
      <div
        className="workbench-body"
        id="example-panel"
        role="tabpanel"
        aria-labelledby={`example-tab-${active}`}
      >
        <div className="source-panel">
          <div className="panel-kicker"><span>Source</span><span>{example.source.split('\n').length} lines</span></div>
          <pre><code>{example.source}</code></pre>
        </div>
        <div className="render-panel">
          <div className="panel-kicker"><span>Rendered scene</span><span>responsive</span></div>
          <div className="render-canvas">
            <Image key={example.image} src={example.image} alt={example.alt} width={960} height={162} priority />
          </div>
          <div className="timeline-bar">
            <button type="button" onClick={advance} aria-label="Show next Livery example"><ArrowRight size={12} /></button>
            <span className="timeline-track"><i style={{ width: `${((active + 1) / examples.length) * 100}%` }} /></span>
            <span>0{active + 1} / 0{examples.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
