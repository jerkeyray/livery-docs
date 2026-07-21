import Image from 'next/image';
import { ArrowRight, Braces, Check } from 'lucide-react';

const source = `figure agent_system {
  user = person("User")
  agent = agent("Research agent")
  model = model("Reasoning model")
  search = tool("Web search")

  user.right -> agent.left("ask")
  agent.right -> model.left("reason")
  agent.bottom -> search.top("query")
}`;

export function HeroDemo() {
  return (
    <div className="hero-demo-pair">
      <div className="hero-source-card">
        <div className="hero-source-head">
          <span><Braces size={12} /> Source</span>
          <span>{source.split('\n').length} lines</span>
        </div>
        <pre><code>{source}</code></pre>
        <div className="hero-source-foot">
          <span>agent-system.livery</span>
          <ArrowRight size={13} />
        </div>
      </div>

      <span className="hero-compile-arrow" aria-hidden="true"><ArrowRight size={14} /></span>

      <div className="hero-output-card">
        <div className="hero-diagram-tabs" aria-label="Supported diagram families">
          <span className="is-active">Flowchart</span>
          <span>Sequence</span>
          <span>Architecture</span>
          <span>State</span>
        </div>
        <span className="hero-output-valid"><Check size={11} /> valid geometry</span>
        <Image
          className="hero-figure-wide"
          src="/agent-system.svg"
          alt="Research agent system connecting a user, agent, reasoning model, web search, memory, and final report"
          width={720}
          height={272}
          priority
        />
        <Image
          className="hero-figure-tall"
          src="/agent-system-mobile.svg"
          alt="Research agent system connecting a user, agent, reasoning model, web search, memory, and final report"
          width={600}
          height={712}
          priority
        />
      </div>
    </div>
  );
}
