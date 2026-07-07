// SPDX-License-Identifier: AGPL-3.0-or-later
// Per-file image encryption (AES-256-GCM via WebCrypto). The blob a media
// server stores is pure ciphertext: it cannot scan, profile, or selectively
// censor pixels it cannot see. The one-time key rides in the post URL's
// fragment (never sent in HTTP requests), so anyone who can read the post on
// a relay can decrypt - this blinds the media host, it is NOT secrecy from
// relay readers. One random key per file: leaking one never exposes another.

import { parseEncryptedImageUrl } from '../lib/images.js';

// Public Blossom servers (nostr.build, blossom.band) sniff uploaded bytes and
// reject anything that isn't a real image, so raw ciphertext bounces with 415.
// The ciphertext therefore rides AFTER the IEND of a valid 1x1 transparent
// PNG: sniffers see a genuine PNG, image decoders ignore trailing bytes, and
// blobs are served back byte-identical (content-addressed), verified against
// both default servers. The pixels stay invisible to the host either way.
const PNG_STUB = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='),
  (c) => c.charCodeAt(0),
);

// Raster formats only. Never svg/html: a decrypted blob: URL inherits the
// app's origin, so a scriptable type opened in a new tab would be XSS with
// access to stored keys. Relay/media content is hostile input (CLAUDE.md §5).
const SAFE_SUBTYPES = new Set(['jpeg', 'jpg', 'png', 'webp', 'gif', 'avif']);

// Defense in depth: the decrypted blob's MIME type comes from the actual
// bytes (magic numbers), never from the attacker-controlled fragment label.
// Plaintext that isn't a known raster image is rejected outright, so a blob:
// document can never carry a scriptable type no matter what the post claims.
function sniffImageSubtype(b) {
  if (b.length > 11 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (b.length > 11 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (b.length > 11 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return 'gif';
  if (b.length > 11 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46
    && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'webp'; // RIFF….WEBP
  if (b.length > 11 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70
    && b[8] === 0x61 && b[9] === 0x76) return 'avif'; // ISO BMFF ftyp, brand av01/avif/avis
  return null;
}

/**
 * Encrypt image bytes with a fresh random key.
 * Returns the ciphertext to upload and the URL fragment that carries the key:
 * `enc=v1.<key>.<iv>.<subtype>` (base64url, no padding).
 */
export async function encryptImage(bytes, mimeType) {
  const keyBytes = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt']);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes));
  const data = new Uint8Array(PNG_STUB.length + cipher.length);
  data.set(PNG_STUB, 0);
  data.set(cipher, PNG_STUB.length);
  const fragment = `enc=v1.${b64url(keyBytes)}.${b64url(iv)}.${safeSubtype(mimeType)}`;
  return { data, fragment };
}

/**
 * Decrypt ciphertext using the parts parsed from an encrypted-image URL.
 * The fragment's subtype label is ignored; the type is sniffed from the
 * decrypted bytes and non-raster plaintext is rejected (see above).
 */
export async function decryptImage(containerBytes, { key, iv }) {
  // Peel the PNG shell; a wrong or tampered shell fails loudly. The GCM tag
  // authenticates the ciphertext itself right after.
  if (containerBytes.length <= PNG_STUB.length
    || !PNG_STUB.every((b, i) => containerBytes[i] === b)) throw new Error('bad-container');
  const cipherBytes = containerBytes.subarray(PNG_STUB.length);
  const cryptoKey = await crypto.subtle.importKey('raw', unb64url(key), 'AES-GCM', false, ['decrypt']);
  const plain = new Uint8Array(
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64url(iv) }, cryptoKey, cipherBytes),
  );
  const subtype = sniffImageSubtype(plain);
  if (!subtype) throw new Error('not-an-image');
  return new Blob([plain], { type: 'image/' + subtype });
}

/** Fetch an encrypted image and decrypt it in the browser. Returns a Blob. */
export async function fetchDecryptedImage(url) {
  const parsed = parseEncryptedImageUrl(url);
  if (!parsed) throw new Error('bad-encrypted-url');
  const res = await fetch(parsed.base);
  if (!res.ok) throw new Error(`fetch ${res.status}`);
  const cipher = new Uint8Array(await res.arrayBuffer());
  return decryptImage(cipher, parsed);
}

// GCM authenticates: tampered ciphertext or a wrong key throws in decrypt.

function safeSubtype(mime) {
  const sub = String(mime || '').replace(/^image\//, '').toLowerCase();
  if (!SAFE_SUBTYPES.has(sub)) return 'jpeg';
  return sub === 'jpg' ? 'jpeg' : sub;
}

function b64url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function unb64url(text) {
  const raw = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
