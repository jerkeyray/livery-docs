import { describe, expect, it } from 'bun:test';
import { render } from '@jerkeyray/core';
import { studioStarterPrompts } from './studio-prompts.ts';
import { classifyVisualFamily, shouldUseDraftModel } from './studio-agent.ts';

const compactReferenceSources = {
  checkout: `figure checkout("Checkout") {
    browser = card("Browser", variant: muted)
    api = service("Checkout API", variant: soft, tone: info)
    stripe = service("Stripe", variant: muted)
    postgres = database("Postgres", variant: muted)
    queue = queue("Queue", variant: muted)
    worker = service("Fulfillment Worker", variant: soft, tone: success)
    connect(browser.right, api.left, label: "checkout", role: primary)
    connect(api.right, queue.left, label: "publish", role: primary)
    connect(queue.right, worker.left, label: "dispatch", role: primary)
    connect(api.bottom, stripe.top, label: "authorize", role: supporting)
    connect(api.bottom, postgres.top, label: "write order", role: supporting)
    flow(browser, api, stripe, postgres, queue, worker, direction: right, gap: $space.sm, rankGap: $space.md)
  }`,
  research: `figure research("AI research") {
    user = card("User", subtitle: "Research request", variant: muted)
    agent = card("Research Agent", subtitle: "Plans and reasons", variant: soft, tone: info)
    tools = list("Research Tools", items: ["Web Search", "Document Retrieval"], variant: muted)
    evidence = card("Evidence", subtitle: "Accepted findings", variant: soft, tone: success)
    answer = card("Cited Answer", subtitle: "Evidence checked", variant: solid)
    connect(user.right, agent.left, label: "request", role: primary)
    connect(agent.right, evidence.left, label: "synthesize", role: primary)
    connect(evidence.right, answer.left, label: "answer", role: primary)
    connect(agent.bottom, tools.top, label: "research", role: supporting)
    connect(tools.right, evidence.bottom, label: "findings", role: supporting)
    flow(user, agent, tools, evidence, answer, direction: right, gap: $space.sm, rankGap: $space.md)
  }`,
  realtime: `figure realtime("Realtime analytics") {
    events = card("Product Events", variant: muted)
    api = service("Event API", variant: soft, tone: info)
    kafka = queue("Kafka", variant: muted)
    processor = service("Stream Processor", variant: soft, tone: info)
    warehouse = database("Warehouse", variant: muted)
    dashboard = card("Live Dashboard", variant: solid)
    connect(events.right, api.left, label: "ingest", role: primary)
    connect(api.right, kafka.left, label: "publish", role: primary)
    connect(kafka.bottom, processor.top, label: "stream", role: primary)
    connect(processor.left, warehouse.right, label: "store", role: primary)
    connect(warehouse.left, dashboard.right, label: "query", role: primary)
    grid(events, api, kafka, dashboard, warehouse, processor, columns: 3, gap: $space.md)
  }`,
  deployment: `figure deployment("Safe deployment") {
    commit = card("Commit", variant: muted)
    tests = service("CI Tests", variant: muted)
    canary = service("Canary", variant: soft, tone: warning)
    health = card("Health Check", variant: soft)
    production = service("Production", variant: soft, tone: success)
    rollback = service("Rollback", variant: soft, tone: danger)
    connect(commit.right, tests.left, role: primary)
    connect(tests.right, canary.left, role: primary)
    connect(canary.right, health.left, role: primary)
    connect(health.right, production.left, label: "pass", role: secondary)
    connect(health.right, rollback.left, label: "fail", role: secondary)
    flow(commit, tests, canary, health, production, rollback, direction: right, gap: $space.xs, rankGap: $space.xs)
  }`,
};

describe('Studio starter prompts', () => {
  it('request compact landscape native-flow compositions', () => {
    for (const starter of studioStarterPrompts) {
      expect(starter.prompt).toContain('compact landscape');
      expect(starter.prompt).toContain('16:9 canvas');
      expect(starter.prompt).toContain('top-level nodes and no frames');
      if (starter.title !== 'Realtime data platform') expect(starter.prompt).toContain('native flow layout with direction right');
      expect(starter.prompt).toContain('outer canvas');
      expect(shouldUseDraftModel(starter.prompt, 0)).toBe(true);
      expect(['architecture', 'flowchart']).toContain(classifyVisualFamily(starter.prompt));
    }
  });

  it('keeps mandatory streaming infrastructure on the realtime data path', () => {
    const realtime = studioStarterPrompts.find(({ title }) => title === 'Realtime data platform');
    expect(realtime?.prompt).toContain('Event API → Kafka → Stream Processor → Warehouse → Live Dashboard');
    expect(realtime?.prompt).toContain('do not bypass Kafka or Warehouse');
    expect(realtime?.prompt).toContain('three-column grid with a folded serpentine reading order');
  });

  it('collapses the research tools into one bounded branch', () => {
    const research = studioStarterPrompts.find(({ title }) => title === 'Research agent');
    expect(research?.prompt).toContain('fits a 900px-wide 16:9 canvas');
    expect(research?.prompt).toContain('exactly five top-level nodes and no frames');
    expect(research?.prompt).toContain('one list component titled Research Tools');
    expect(research?.prompt).toContain('Do not create separate tool nodes');
    expect(research?.prompt).toContain('straight and horizontal');
    expect(research?.prompt).toContain('outer canvas return connectors');
  });

  it('gives every preset one primary reading spine', () => {
    for (const starter of studioStarterPrompts) {
      expect(starter.prompt).toContain('primary reading spine');
      expect(starter.prompt.length).toBeGreaterThan(500);
    }
  });

  it('keeps a compiler-proven 900px topology for every preset', () => {
    for (const [name, source] of Object.entries(compactReferenceSources)) {
      const result = render(source, { width: 900 });
      expect(result.svg, `${name}: ${result.diagnostics.map(({ code }) => code).join(', ')}`).toBeDefined();
      expect(result.diagnostics.filter(({ severity }) => severity === 'error')).toEqual([]);
    }
  }, 30000);

  it('keeps the folded realtime path valid at narrow widths', () => {
    for (const width of [600, 480]) {
      const result = render(compactReferenceSources.realtime, { width });
      expect(result.svg, `${width}px: ${result.diagnostics.map(({ code }) => code).join(', ')}`).toBeDefined();
      expect(result.diagnostics.filter(({ severity }) => severity === 'error')).toEqual([]);
    }
  }, 30000);
});
