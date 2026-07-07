// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { containsNsec } from './nsecGuard.js';

// A well-formed-looking nsec (nsec1 + 58 bech32 chars). Not a real key.
const NSEC = `nsec1${'q'.repeat(58)}`;

test('detects a bare nsec', () => {
  assert.equal(containsNsec(NSEC), true);
});

test('detects an nsec embedded in surrounding text', () => {
  assert.equal(containsNsec(`oops my key is ${NSEC} please help`), true);
});

test('is case-insensitive', () => {
  assert.equal(containsNsec(NSEC.toUpperCase()), true);
});

test('ignores the word nsec in prose', () => {
  assert.equal(containsNsec('remember to back up your nsec safely'), false);
});

test('ignores an npub (public key)', () => {
  assert.equal(containsNsec(`npub1${'q'.repeat(58)}`), false);
});

test('ignores a too-short nsec-like fragment', () => {
  assert.equal(containsNsec(`nsec1${'q'.repeat(10)}`), false);
});

test('handles non-string input', () => {
  assert.equal(containsNsec(null), false);
  assert.equal(containsNsec(undefined), false);
});
