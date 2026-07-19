import { describe, expect, it } from 'bun:test';
import {
  calculateStudioFitZoom,
  clampStudioSidebarWidth,
  clampStudioZoom,
  diagnosticRange,
  STUDIO_SIDEBAR_DEFAULT,
} from './studio-workbench.ts';

describe('Studio workbench helpers', () => {
  it('clamps persisted sidebar widths', () => {
    expect(clampStudioSidebarWidth(undefined)).toBe(STUDIO_SIDEBAR_DEFAULT);
    expect(clampStudioSidebarWidth(100)).toBe(320);
    expect(clampStudioSidebarWidth(501.4)).toBe(501);
    expect(clampStudioSidebarWidth(900)).toBe(680);
  });

  it('fits content without upscaling and clamps manual zoom', () => {
    expect(calculateStudioFitZoom({ width: 1000, height: 700 }, { width: 900, height: 500 })).toBe(1);
    expect(calculateStudioFitZoom({ width: 500, height: 400 }, { width: 900, height: 500 })).toBe(0.45);
    expect(clampStudioZoom(0.1)).toBe(0.25);
    expect(clampStudioZoom(2.4)).toBe(2);
  });

  it('maps multiline and zero-width compiler spans safely', () => {
    expect(diagnosticRange(20, { start: { offset: 4 }, end: { offset: 12 } })).toEqual({ from: 4, to: 12 });
    expect(diagnosticRange(20, { start: { offset: 20 }, end: { offset: 20 } })).toEqual({ from: 20, to: 20 });
    expect(diagnosticRange(20, { start: { offset: 5 }, end: { offset: 5 } })).toEqual({ from: 5, to: 6 });
    expect(diagnosticRange(20)).toBeUndefined();
  });
});
