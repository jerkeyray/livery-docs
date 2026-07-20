import { describe, expect, it } from 'bun:test';
import { render } from 'liveryscript';
import { studioExamples } from './studio-examples.ts';

describe('Studio example gallery', () => {
  it('uses stable identifiers and covers the promised families', () => {
    expect(new Set(studioExamples.map(({ id }) => id)).size).toBe(studioExamples.length);
    expect(new Set(studioExamples.map(({ family }) => family))).toEqual(
      new Set(['Architecture', 'Workflow', 'Data', 'Hierarchy', 'Sequence'])
    );
  });

  it('compiles every source at desktop and compact widths', () => {
    for (const example of studioExamples) {
      for (const width of [900, 480]) {
        const result = render(example.source, { width });
        const errors = result.diagnostics.filter(({ severity }) => severity === 'error');
        expect(result.svg, `${example.id} at ${width}px: ${errors.map(({ code }) => code).join(', ')}`).toBeDefined();
        expect(errors).toEqual([]);
      }
    }
  }, 30_000);
});
