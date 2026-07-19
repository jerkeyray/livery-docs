export type StudioSidebarTab = 'chat' | 'source' | 'examples';

export type StudioViewportState = {
  mode: 'fit' | 'manual';
  zoom: number;
};

export const STUDIO_SIDEBAR_DEFAULT = 420;
export const STUDIO_SIDEBAR_MIN = 320;
export const STUDIO_SIDEBAR_MAX = 680;
export const STUDIO_ZOOM_MIN = 0.25;
export const STUDIO_ZOOM_MAX = 2;
export const STUDIO_ZOOM_STEP = 0.1;

export function clampStudioSidebarWidth(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return STUDIO_SIDEBAR_DEFAULT;
  return Math.round(Math.max(STUDIO_SIDEBAR_MIN, Math.min(STUDIO_SIDEBAR_MAX, value)));
}

export function clampStudioZoom(value: number): number {
  const clamped = Math.max(STUDIO_ZOOM_MIN, Math.min(STUDIO_ZOOM_MAX, value));
  return Math.round(clamped * 100) / 100;
}

export function calculateStudioFitZoom(
  viewport: { width: number; height: number },
  content: { width: number; height: number },
  padding = 48,
): number {
  if (viewport.width <= 0 || viewport.height <= 0 || content.width <= 0 || content.height <= 0) return 1;
  const availableWidth = Math.max(1, viewport.width - padding * 2);
  const availableHeight = Math.max(1, viewport.height - padding * 2);
  return clampStudioZoom(Math.min(1, availableWidth / content.width, availableHeight / content.height));
}

export function diagnosticRange(
  sourceLength: number,
  span?: { start: { offset: number }; end: { offset: number } },
): { from: number; to: number } | undefined {
  if (!span) return undefined;
  const from = Math.max(0, Math.min(sourceLength, span.start.offset));
  const end = Math.max(from, Math.min(sourceLength, span.end.offset));
  return { from, to: end === from && from < sourceLength ? from + 1 : end };
}
