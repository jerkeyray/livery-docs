import { describe, expect, test } from 'bun:test';
import { clearStudioDraft, readStudioDraft, STUDIO_DRAFT_STORAGE_KEY, writeStudioDraft } from './studio-storage';

const draft = {
  version: 1,
  source: 'figure demo("Demo") {}',
  acceptedSource: 'figure demo("Demo") {}',
  input: 'Add a queue',
  theme: 'midnight',
  messages: [{ id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'Draw a system' }] }],
};

describe('Studio draft storage', () => {
  test('round-trips the working session', () => {
    const values = new Map();
    writeStudioDraft({ setItem: (key, value) => values.set(key, value) }, draft);
    expect(readStudioDraft({ getItem: (key) => values.get(key) ?? null })).toEqual(draft);
  });

  test('ignores malformed or outdated sessions', () => {
    expect(readStudioDraft({ getItem: () => '{broken' })).toBeUndefined();
    expect(readStudioDraft({ getItem: () => JSON.stringify({ ...draft, version: 2 }) })).toBeUndefined();
    expect(readStudioDraft({ getItem: () => JSON.stringify({ ...draft, theme: 'unknown' }) })).toBeUndefined();
  });

  test('uses a versioned browser key', () => {
    expect(STUDIO_DRAFT_STORAGE_KEY).toBe('livery.studio.draft.v1');
  });

  test('clears the persisted working session', () => {
    let removed;
    clearStudioDraft({ removeItem: (key) => { removed = key; } });
    expect(removed).toBe(STUDIO_DRAFT_STORAGE_KEY);
  });
});
