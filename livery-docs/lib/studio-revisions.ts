export type StudioRevisionState = {
  entries: string[];
  index: number;
};

export const STUDIO_REVISION_LIMIT = 20;

export function createRevisionState(source = ''): StudioRevisionState {
  return { entries: [source], index: 0 };
}

export function normalizeRevisionState(entries: unknown, index: unknown, fallback = ''): StudioRevisionState {
  if (!Array.isArray(entries) || entries.length === 0 || !entries.every((entry) => typeof entry === 'string')) {
    return createRevisionState(fallback);
  }
  const normalizedIndex = typeof index === 'number' && Number.isInteger(index)
    ? Math.max(0, Math.min(index, entries.length - 1))
    : entries.length - 1;
  const start = Math.max(0, entries.length - STUDIO_REVISION_LIMIT);
  const normalizedEntries = entries.slice(start);
  return { entries: normalizedEntries, index: Math.max(0, normalizedIndex - start) };
}

export function appendRevision(state: StudioRevisionState, source: string): StudioRevisionState {
  if (state.entries[state.index] === source) return state;
  const entries = [...state.entries.slice(0, state.index + 1), source].slice(-STUDIO_REVISION_LIMIT);
  return { entries, index: entries.length - 1 };
}

export function replaceCurrentRevision(state: StudioRevisionState, source: string): StudioRevisionState {
  if (state.entries[state.index] === source) return state;
  const entries = [...state.entries];
  entries[state.index] = source;
  return { entries, index: state.index };
}

export function moveRevision(state: StudioRevisionState, delta: -1 | 1): StudioRevisionState {
  return { ...state, index: Math.max(0, Math.min(state.index + delta, state.entries.length - 1)) };
}
