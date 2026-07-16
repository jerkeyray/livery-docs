import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  Check,
  Coffee,
  Sparkles,
} from 'lucide-react';
import { HeroDemo } from '@/components/hero-demo';

const outputs = ['React', 'Browser', 'SVG', 'PNG', 'JSON', 'CLI'];

function GitHubMark({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

export default function HomePage() {
  return (
    <main className="landing-shell">
      <nav className="landing-nav" aria-label="Main navigation">
        <Link href="/" className="landing-brand" aria-label="Livery home">
          <Image src="/livery-mark.svg" alt="" width={28} height={28} priority />
          <span>livery</span>
        </Link>
        <div className="landing-nav-links">
          <Link href="/docs">Docs</Link>
        </div>
        <div className="landing-nav-actions">
          <a
            className="repo-link"
            href="https://github.com/jerkeyray/livery"
            target="_blank"
            rel="noreferrer"
            aria-label="Livery on GitHub"
          >
            <GitHubMark size={16} /> GitHub
          </a>
        </div>
      </nav>

      <section className="hero-section">
        <div className="hero-copy">
          <div className="eyebrow">
            Built for agents &amp; humans
          </div>
          <h1>
            Make systems
            <span>visible.</span>
          </h1>
          <p className="hero-lede">
            A small visual language that turns structured ideas into validated,
            responsive technical diagrams.
          </p>
          <div className="hero-actions">
            <Link href="/studio" className="primary-button">
              Try the playground <ArrowRight size={17} />
            </Link>
            <Link href="/docs" className="secondary-button">Read the docs</Link>
          </div>
          <div className="hero-proof" aria-label="Livery highlights">
            <span><strong>01</strong> typed diagnostics</span>
            <span><strong>02</strong> deterministic output</span>
            <span><strong>03</strong> retained state</span>
          </div>
        </div>

        <HeroDemo />
      </section>

      <div className="marquee-strip" aria-hidden="true">
        <span>Describe</span><i>✦</i><span>Validate</span><i>✦</i><span>Render</span><i>✦</i>
        <span>Animate</span><i>✦</i><span>Export</span><i>✦</i><span>Repeat</span>
      </div>

      <section className="manifesto-section" id="geometry">
        <div className="manifesto-copy">
          <span className="section-index">01 / Geometry first</span>
          <h2>Bad geometry never makes it to the canvas.</h2>
          <p>
            Livery checks bounds, collisions, text, and connectors before a renderer receives the scene. Failures return typed diagnostics.
          </p>
        </div>
        <div className="validation-card">
          <div className="validation-head"><span>geometry.report</span><span className="valid-pill"><Check size={11} /> passed</span></div>
          {['bounds', 'collisions', 'connectors', 'text fit'].map((label) => (
            <div className="validation-row" key={label}>
              <span><Check size={14} /> {label}</span>
              <code>valid</code>
            </div>
          ))}
          <div className="validation-footer">4 checks · 0 warnings · 8ms</div>
        </div>
      </section>

      <section className="runtime-section" id="runtime">
        <div className="runtime-copy">
          <span className="section-index">02 / Portable by design</span>
          <h2>One scene.<br /><em>Everywhere it needs to be.</em></h2>
          <p>
            Compile once. Render in React or the browser, or export deterministic SVG, PNG, and JSON from the CLI.
          </p>
          <Link href="/docs" className="text-link">Explore the runtime <ArrowRight size={16} /></Link>
        </div>
        <div className="runtime-map" aria-label="Livery output targets">
          <div className="map-source">
            <Image src="/livery-mark.svg" alt="" width={34} height={34} />
            <span><strong>Livery scene</strong><small>validated · portable</small></span>
          </div>
          <div className="map-line" aria-hidden="true" />
          <div className="output-grid">
            {outputs.map((output, index) => <div key={output}><span>0{index + 1}</span>{output}</div>)}
          </div>
        </div>
      </section>

      <section className="closing-section">
        <div className="closing-orbit" aria-hidden="true">
          <span className="orbit-ring orbit-ring-one" />
          <span className="orbit-ring orbit-ring-two" />
          <Image src="/livery-mark.svg" alt="" width={74} height={74} />
        </div>
        <div className="closing-copy">
          <span className="section-index"><Sparkles size={12} /> Start with a scene</span>
          <h2>Give your agent<br />a visual vocabulary.</h2>
          <p>Readable source in. Reliable geometry out.</p>
          <Link href="/docs/getting-started" className="primary-button">
            Build your first figure <ArrowRight size={17} />
          </Link>
        </div>
      </section>

      <footer className="landing-footer">
        <p className="footer-credit">
          <span>built by</span>
          <a href="https://jerkeyray.com" target="_blank" rel="noreferrer">aditya srivastava</a>
          <i aria-hidden="true">·</i>
          <a href="https://jerkeyray.com" target="_blank" rel="noreferrer">jerkeyray.com</a>
        </p>
        <a
          className="support-link"
          href="https://buymeacoffee.com/jerkeyray"
          target="_blank"
          rel="noreferrer"
        >
          <Coffee size={15} /> support the project
        </a>
      </footer>
    </main>
  );
}
