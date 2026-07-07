// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encryptImage, decryptImage } from './mediacrypt.js';
import { parseEncryptedImageUrl } from '../lib/images.js';

const PIXELS = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4]);

test('encrypt/decrypt round-trip restores the original bytes', async () => {
  const { data, fragment } = await encryptImage(PIXELS, 'image/png');
  // Container: a valid PNG shell up front (so image-sniffing Blossom servers
  // accept it), ciphertext after - never the pixels themselves.
  assert.deepEqual([...data.slice(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
  assert.equal([...data].join(',').includes([...PIXELS].join(',')), false);
  const parsed = parseEncryptedImageUrl(`https://serv/abc#${fragment}`);
  const blob = await decryptImage(data, parsed);
  assert.equal(blob.type, 'image/png');
  assert.deepEqual(new Uint8Array(await blob.arrayBuffer()), PIXELS);
});

test('each file gets its own key', async () => {
  const a = await encryptImage(PIXELS, 'image/png');
  const b = await encryptImage(PIXELS, 'image/png');
  assert.notEqual(a.fragment, b.fragment);
  assert.notDeepEqual([...a.data], [...b.data]);
});

test('unsafe or unknown mime types are coerced to a raster type', async () => {
  const svg = await encryptImage(PIXELS, 'image/svg+xml');
  assert.match(svg.fragment, /\.jpeg$/);
  const jpg = await encryptImage(PIXELS, 'image/jpg');
  assert.match(jpg.fragment, /\.jpeg$/);
});

test('blob type comes from magic bytes, not the fragment label', async () => {
  const { data, fragment } = await encryptImage(PIXELS, 'image/png'); // PNG magic bytes
  const forged = fragment.replace(/\.png$/, '.gif'); // attacker lies about the type
  const parsed = parseEncryptedImageUrl(`https://serv/abc#${forged}`);
  const blob = await decryptImage(data, parsed);
  assert.equal(blob.type, 'image/png');
});

test('non-image plaintext is rejected after decryption', async () => {
  const html = new TextEncoder().encode('<html><script>steal()</script></html>');
  const { data, fragment } = await encryptImage(html, 'image/png');
  const parsed = parseEncryptedImageUrl(`https://serv/abc#${fragment}`);
  await assert.rejects(() => decryptImage(data, parsed), /not-an-image/);
});

test('tampered ciphertext fails decryption (GCM auth)', async () => {
  const { data, fragment } = await encryptImage(PIXELS, 'image/png');
  data[data.length - 1] ^= 0xff; // flip inside the ciphertext, not the shell
  const parsed = parseEncryptedImageUrl(`https://serv/abc#${fragment}`);
  await assert.rejects(() => decryptImage(data, parsed));
});

test('tampered or missing PNG shell is rejected', async () => {
  const { data, fragment } = await encryptImage(PIXELS, 'image/png');
  const parsed = parseEncryptedImageUrl(`https://serv/abc#${fragment}`);
  const noShell = data.slice(10); // shell stripped
  await assert.rejects(() => decryptImage(noShell, parsed), /bad-container/);
  data[0] ^= 0xff; // shell corrupted
  await assert.rejects(() => decryptImage(data, parsed), /bad-container/);
});
