// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractImageUrls, isEncryptedImageUrl, parseEncryptedImageUrl } from './images.js';

const ENC = 'https://serv.example/abc123#enc=v1.a-Zz09_A.qqqq.png';
const PLAIN = 'https://img.example/cat.jpg';

test('extracts plain image urls', () => {
  assert.deepEqual(extractImageUrls(`look ${PLAIN} wow`), [PLAIN]);
});

test('extracts encrypted image urls', () => {
  assert.deepEqual(extractImageUrls(`pic ${ENC} end`), [ENC]);
});

test('extracts both kinds in order of appearance', () => {
  assert.deepEqual(extractImageUrls(`${ENC}\n${PLAIN}`), [ENC, PLAIN]);
});

test('plain pattern never swallows an encrypted fragment ending in an extension', () => {
  const [only] = extractImageUrls(ENC);
  assert.equal(only, ENC);
  assert.equal(isEncryptedImageUrl(only), true);
});

test('encrypted url whose base ends in an image extension stays one match', () => {
  // Blossom servers append .png to the blob path; the plain pattern must not
  // claim the prefix and strand the fragment.
  const url = 'https://serv.example/abc123.png#enc=v1.kkkk.vvvv.png';
  assert.deepEqual(extractImageUrls(`x ${url} y`), [url]);
  assert.equal(isEncryptedImageUrl(url), true);
});

test('non-image urls are ignored', () => {
  assert.deepEqual(extractImageUrls('https://example.com/page.html no image'), []);
});

test('isEncryptedImageUrl rejects plain urls and junk', () => {
  assert.equal(isEncryptedImageUrl(PLAIN), false);
  assert.equal(isEncryptedImageUrl('https://serv/abc#enc=v2.a.b.png'), false);
  assert.equal(isEncryptedImageUrl('not a url'), false);
});

test('parseEncryptedImageUrl splits base, key, iv, subtype', () => {
  assert.deepEqual(parseEncryptedImageUrl(ENC), {
    base: 'https://serv.example/abc123',
    key: 'a-Zz09_A',
    iv: 'qqqq',
    subtype: 'png',
  });
  assert.equal(parseEncryptedImageUrl(PLAIN), null);
});
