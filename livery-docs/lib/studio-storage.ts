import type { BuiltInThemeName } from '@jerkeyray/core';
import type { UIMessage } from 'ai';
import { normalizeRevisionState } from './studio-revisions';

export const STUDIO_DRAFT_STORAGE_KEY = 'livery.studio.draft.v1';

export type StudioDraft = {
  version: 1;
  source: string;
  acceptedSource: string;
  input: string;
  theme: BuiltInThemeName;
  messages: UIMessage[];
  revisions: string[];
  revisionIndex: number;
};

const themeNames = new Set<BuiltInThemeName>(['editorial', 'paper', 'midnight', 'blackout', 'blueprint', 'monochrome']);

export function readStudioDraft(storage: Pick<Storage, 'getItem'>): StudioDraft | undefined {
  try {
    const raw = storage.getItem(STUDIO_DRAFT_STORAGE_KEY);
    if (!raw) return undefined;
    const value = JSON.parse(raw) as Partial<StudioDraft>;
    if (value.version !== 1
      || typeof value.source !== 'string'
      || typeof value.acceptedSource !== 'string'
      || typeof value.input !== 'string'
      || !themeNames.has(value.theme as BuiltInThemeName)
      || !Array.isArray(value.messages)
      || !value.messages.every(isUIMessage)) return undefined;
    const revisions = normalizeRevisionState(value.revisions, value.revisionIndex, value.acceptedSource);
    return { ...value, revisions: revisions.entries, revisionIndex: revisions.index } as StudioDraft;
  } catch {
    return undefined;
  }
}

export function writeStudioDraft(storage: Pick<Storage, 'setItem'>, draft: StudioDraft): void {
  try {
    storage.setItem(STUDIO_DRAFT_STORAGE_KEY, JSON.stringify(draft));
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
