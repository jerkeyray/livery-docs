import { describe, expect, test } from 'bun:test';
import { compileProgram, renderVisualPlan, visualPlanSchema } from 'liveryscript';

const tokenBucket = {
  type: 'livery.plan', version: '0.1', id: 'token_bucket', title: 'Token Bucket Rate Limiter', family: 'explainer', direction: 'right',
  nodes: [
    { id: 'requests', label: 'Incoming requests', kind: 'client' },
    { id: 'bucket', label: 'Token bucket', kind: 'process', emphasis: true },
    { id: 'accepted', label: 'Accepted', kind: 'outcome', status: 'success' },
    { id: 'service', label: 'API service', kind: 'service' },
    { id: 'rejected', label: 'Rejected', kind: 'outcome', status: 'danger' },
  ],
  edges: [
    { id: 'arrive', from: 'requests', to: 'bucket', label: 'check', kind: 'flow' },
    { id: 'allow', from: 'bucket', to: 'accepted', label: 'allow', kind: 'flow' },
    { id: 'continue', from: 'accepted', to: 'service', label: 'forward', kind: 'flow' },
    { id: 'deny', from: 'bucket', to: 'rejected', label: 'empty', kind: 'branch' },
  ],
  annotations: [
    { id: 'capacity', target: 'bucket', text: 'Capacity: 10', kind: 'constraint' },
    { id: 'refill', target: 'bucket', text: 'Refill: 2/sec', kind: 'behavior' },
    { id: 'cost', target: 'bucket', text: 'Cost: 1 token/request', kind: 'behavior' },
    { id: 'burst', target: 'bucket', text: 'Burst: up to 10', kind: 'behavior' },
    { id: 'status', target: 'rejected', text: 'HTTP 429', kind: 'fact' },
  ],
  groups: [],
};

describe('Studio semantic plan integration', () => {
  test('accepts the token-bucket plan without a DSL repair attempt', () => {
    expect(visualPlanSchema.safeParse(tokenBucket).success).toBe(true);
    const rendered = renderVisualPlan(tokenBucket, { width: 900 });
    expect(rendered.diagnostics).toEqual([]);
    expect(rendered.quality.acceptable).toBe(true);
    expect(rendered.svg).toContain('HTTP 429');
    expect(rendered.svg).toContain('Cost: 1 token/request');
    expect(rendered.svg).toContain('Burst: up to 10');
    expect(rendered.source).not.toContain('__livery_annotation_');
    expect(rendered.scene.elements.find(({ id }) => id === 'bucket').bounds.height).toBeGreaterThan(86);
    expect(compileProgram(rendered.source).diagnostics).toEqual([]);
  });

  test('keeps facts as annotations instead of semantic nodes', () => {
    const parsed = visualPlanSchema.parse(tokenBucket);
    expect(parsed.nodes.map(({ label }) => label)).not.toContain('HTTP 429');
    expect(parsed.annotations.map(({ text }) => text)).toContain('HTTP 429');
  });
});
