import { describe, expect, it } from 'bun:test';
import { appendRevision, createRevisionState, moveRevision, normalizeRevisionState, replaceCurrentRevision, STUDIO_REVISION_LIMIT } from './studio-revisions';

describe('Studio revisions', () => {
  it('appends after the current revision and discards a stale redo branch', () => {
    let state = appendRevision(createRevisionState('one'), 'two');
    state = appendRevision(state, 'three');
    state = moveRevision(state, -1);
    expect(appendRevision(state, 'replacement')).toEqual({ entries: ['one', 'two', 'replacement'], index: 2 });
  });

  it('replaces a manual editing revision without creating one per keystroke', () => {
    const state = appendRevision(createRevisionState('one'), 'two');
    expect(replaceCurrentRevision(state, 'two edited')).toEqual({ entries: ['one', 'two edited'], index: 1 });
  });

  it('bounds history and safely normalizes restored state', () => {
    let state = createRevisionState('zero');
    for (let index = 1; index <= STUDIO_REVISION_LIMIT + 4; index += 1) state = appendRevision(state, String(index));
    expect(state.entries).toHaveLength(STUDIO_REVISION_LIMIT);
    expect(state.entries.at(-1)).toBe(String(STUDIO_REVISION_LIMIT + 4));
    expect(normalizeRevisionState(['one', 'two'], 99, 'fallback')).toEqual({ entries: ['one', 'two'], index: 1 });
    expect(normalizeRevisionState(undefined, undefined, 'fallback')).toEqual({ entries: ['fallback'], index: 0 });
  });
});
