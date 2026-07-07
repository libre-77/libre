import { test } from 'node:test';
import assert from 'node:assert/strict';
import { windowed, pageCursor } from './paging.js';

test('windowed leaves the filter untouched without a cursor', () => {
  const filter = { kinds: [1], limit: 100 };
  assert.equal(windowed(filter, undefined), filter); // same reference, no copy
  assert.deepEqual(windowed(filter, undefined), { kinds: [1], limit: 100 });
});

test('windowed adds an until bound and does not mutate the input', () => {
  const filter = { kinds: [1], limit: 100 };
  assert.deepEqual(windowed(filter, 1700), { kinds: [1], limit: 100, until: 1700 });
  assert.equal(filter.until, undefined);
});

test('pageCursor reports no more for an empty page', () => {
  assert.deepEqual(pageCursor([], 100), { hasMore: false, nextUntil: null });
});

test('pageCursor flags more when the page is full and points at the oldest event', () => {
  const events = [{ created_at: 300 }, { created_at: 100 }, { created_at: 200 }];
  assert.deepEqual(pageCursor(events, 3), { hasMore: true, nextUntil: 100 });
});

test('pageCursor reports no more when the page is under the limit', () => {
  const events = [{ created_at: 300 }, { created_at: 100 }];
  assert.deepEqual(pageCursor(events, 100), { hasMore: false, nextUntil: 100 });
});
