import { visualPlanSchema, type BuiltInThemeName, type VisualPlan } from 'liveryscript';
import type { UIMessage } from 'ai';
import { normalizeRevisionState } from './studio-revisions';
import { clampStudioSidebarWidth, STUDIO_SIDEBAR_DEFAULT } from './studio-workbench';

export const STUDIO_DRAFT_STORAGE_KEY = 'livery.studio.draft.v1';
export const STUDIO_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

export type StudioDraft = {
  version: 1;
  source: string;
  acceptedSource: string;
  acceptedPlan?: VisualPlan;
  acceptedPlanSource?: string;
  input: string;
  theme: BuiltInThemeName;
  messages: UIMessage[];
  revisions: string[];
  revisionIndex: number;
  sidebarWidth?: number;
};

const themeNames = new Set<BuiltInThemeName>(['editorial', 'paper', 'midnight', 'blackout', 'blueprint', 'monochrome']);
type StoredStudioDraft = StudioDraft & { savedAt?: number };
type ReadableStudioStorage = Pick<Storage, 'getItem'> & Partial<Pick<Storage, 'removeItem'>>;

export function readStudioDraft(storage: ReadableStudioStorage, now = Date.now()): StudioDraft | undefined {
  try {
    const raw = storage.getItem(STUDIO_DRAFT_STORAGE_KEY);
    if (!raw) return undefined;
    const value = JSON.parse(raw) as Partial<StoredStudioDraft>;
    if (typeof value.savedAt === 'number' && now - value.savedAt >= STUDIO_DRAFT_TTL_MS) {
      storage.removeItem?.(STUDIO_DRAFT_STORAGE_KEY);
      return undefined;
    }
    if (value.version !== 1
      || typeof value.source !== 'string'
      || typeof value.acceptedSource !== 'string'
      || typeof value.input !== 'string'
      || !themeNames.has(value.theme as BuiltInThemeName)
      || !Array.isArray(value.messages)
      || !value.messages.every(isUIMessage)) return undefined;
    const revisions = normalizeRevisionState(value.revisions, value.revisionIndex, value.acceptedSource);
    const { savedAt: _savedAt, acceptedPlan: storedPlan, acceptedPlanSource, ...draft } = value;
    const planResult = visualPlanSchema.safeParse(storedPlan);
    const planMatchesSource = typeof acceptedPlanSource === 'string' && acceptedPlanSource === value.acceptedSource;
    return {
      ...draft,
      ...(planResult.success && planMatchesSource ? { acceptedPlan: planResult.data, acceptedPlanSource } : {}),
      revisions: revisions.entries,
      revisionIndex: revisions.index,
      sidebarWidth: value.sidebarWidth === undefined
        ? STUDIO_SIDEBAR_DEFAULT
        : clampStudioSidebarWidth(value.sidebarWidth),
    } as StudioDraft;
  } catch {
    return undefined;
  }
}

export function writeStudioDraft(storage: Pick<Storage, 'setItem'>, draft: StudioDraft, now = Date.now()): void {
  try {
    storage.setItem(STUDIO_DRAFT_STORAGE_KEY, JSON.stringify({ ...draft, savedAt: now } satisfies StoredStudioDraft));
  } catch {
    // Storage can be unavailable or full. The active Studio session should keep working.
  }
}

export function clearStudioDraft(storage: Pick<Storage, 'removeItem'>): void {
  try {
    storage.removeItem(STUDIO_DRAFT_STORAGE_KEY);
  } catch {
    // Clearing a session should still reset the in-memory Studio when storage is unavailable.
  }
}

function isUIMessage(value: unknown): value is UIMessage {
  if (!value || typeof value !== 'object') return false;
  const message = value as Partial<UIMessage>;
  return typeof message.id === 'string'
    && (message.role === 'user' || message.role === 'assistant' || message.role === 'system')
    && Array.isArray(message.parts);
}
