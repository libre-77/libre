import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tallyReactions } from './reactions.js';

const r = (pubkey, target, content, created_at, id = `${pubkey}-${created_at}`) => ({
  id, pubkey, content, created_at, tags: [['e', target]],
});

test('counts up and down per event', () => {
  const events = [r('a', 'p1', '+', 1), r('b', 'p1', '+', 2), r('c', 'p1', '-', 3)];
  assert.deepEqual(tallyReactions(events, ['p1']).get('p1'), { up: 2, down: 1, mine: null, mineIds: [] });
});

test('keeps only the newest vote per pubkey (switching direction)', () => {
  const events = [r('a', 'p1', '+', 1), r('a', 'p1', '-', 5)];
  assert.deepEqual(tallyReactions(events, ['p1']).get('p1'), { up: 0, down: 1, mine: null, mineIds: [] });
});

test('reports the user vote and collects ALL their reaction ids on the event', () => {
  // Two stale votes from the same user - both ids must be returned for cleanup,
  // while the count still collapses to the newest (down).
  const events = [r('me', 'p1', '+', 1, 'rx1'), r('me', 'p1', '-', 3, 'rx2'), r('b', 'p1', '+', 2)];
  assert.deepEqual(tallyReactions(events, ['p1'], 'me').get('p1'),
    { up: 1, down: 1, mine: 'down', mineIds: ['rx1', 'rx2'] });
});

test('ignores emoji/other reaction glyphs', () => {
  const events = [r('a', 'p1', '🔥', 1), r('b', 'p1', '', 2), r('c', 'p1', '+', 3)];
  assert.deepEqual(tallyReactions(events, ['p1']).get('p1'), { up: 1, down: 0, mine: null, mineIds: [] });
});

test('ignores reactions targeting events not requested', () => {
  const events = [r('a', 'other', '+', 1)];
  assert.deepEqual(tallyReactions(events, ['p1']).get('p1'), { up: 0, down: 0, mine: null, mineIds: [] });
});

test('every requested id gets a zeroed entry', () => {
  const out = tallyReactions([], ['p1', 'p2']);
  assert.deepEqual(out.get('p1'), { up: 0, down: 0, mine: null, mineIds: [] });
  assert.deepEqual(out.get('p2'), { up: 0, down: 0, mine: null, mineIds: [] });
});
