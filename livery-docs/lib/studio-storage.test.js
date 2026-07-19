import { describe, expect, test } from 'bun:test';
import { clearStudioDraft, readStudioDraft, STUDIO_DRAFT_STORAGE_KEY, STUDIO_DRAFT_TTL_MS, writeStudioDraft } from './studio-storage';

const draft = {
  version: 1,
  source: 'figure demo("Demo") {}',
  acceptedSource: 'figure demo("Demo") {}',
  input: 'Add a queue',
  theme: 'midnight',
  messages: [{ id: 'user-1', role: 'user', parts: [{ type: 'text', text: 'Draw a system' }] }],
  revisions: ['figure demo("Demo") {}'],
  revisionIndex: 0,
  sidebarWidth: 420,
};

describe('Studio draft storage', () => {
  test('round-trips the working session', () => {
    const values = new Map();
    writeStudioDraft({ setItem: (key, value) => values.set(key, value) }, draft, 1_000);
    expect(readStudioDraft({ getItem: (key) => values.get(key) ?? null }, 1_000 + STUDIO_DRAFT_TTL_MS - 1)).toEqual(draft);
  });

  test('expires and removes an inactive draft after 24 hours', () => {
    const values = new Map();
    let removed;
    writeStudioDraft({ setItem: (key, value) => values.set(key, value) }, draft, 1_000);
    expect(readStudioDraft({
      getItem: (key) => values.get(key) ?? null,
      removeItem: (key) => { removed = key; values.delete(key); },
    }, 1_000 + STUDIO_DRAFT_TTL_MS)).toBeUndefined();
    expect(removed).toBe(STUDIO_DRAFT_STORAGE_KEY);
    expect(values.has(STUDIO_DRAFT_STORAGE_KEY)).toBe(false);
  });

  test('refreshes the expiry timestamp whenever active work is saved', () => {
    const values = new Map();
    writeStudioDraft({ setItem: (key, value) => values.set(key, value) }, draft, 1_000);
    writeStudioDraft({ setItem: (key, value) => values.set(key, value) }, draft, 5_000);
    expect(JSON.parse(values.get(STUDIO_DRAFT_STORAGE_KEY)).savedAt).toBe(5_000);
  });

  test('ignores malformed or outdated sessions', () => {
    expect(readStudioDraft({ getItem: () => '{broken' })).toBeUndefined();
    expect(readStudioDraft({ getItem: () => JSON.stringify({ ...draft, version: 2 }) })).toBeUndefined();
    expect(readStudioDraft({ getItem: () => JSON.stringify({ ...draft, theme: 'unknown' }) })).toBeUndefined();
  });

  test('migrates a draft saved before revision history existed', () => {
    const { revisions: _revisions, revisionIndex: _revisionIndex, sidebarWidth: _sidebarWidth, ...oldDraft } = draft;
    expect(readStudioDraft({ getItem: () => JSON.stringify(oldDraft) })).toEqual(draft);
  });

  test('validates persisted sidebar width without rejecting older drafts', () => {
    expect(readStudioDraft({ getItem: () => JSON.stringify({ ...draft, sidebarWidth: 20 }) })?.sidebarWidth).toBe(320);
    expect(readStudioDraft({ getItem: () => JSON.stringify({ ...draft, sidebarWidth: 'wide' }) })?.sidebarWidth).toBe(420);
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
