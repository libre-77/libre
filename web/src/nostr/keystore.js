// Encrypted key storage. The nsec is never written to disk in plaintext: it is
// encrypted with AES-GCM under a key derived from the user's passphrase
// (PBKDF2, 210k iterations) and only the ciphertext + salt + iv live in
// IndexedDB. The passphrase itself is never stored - it must be re-entered to
// unlock. (Addresses the plaintext-localStorage exposure; see docs/threat-model.)

import { idbGet, idbSet, idbDel } from '../lib/idb.js';

const RECORD = 'local';
const ITERATIONS = 210000;

async function deriveAesKey(passphrase, salt) {
  const base = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Encrypt a hex secret key under `passphrase` and persist the ciphertext. */
export async function saveKey(skHex, passphrase) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const aes = await deriveAesKey(passphrase, salt);
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aes,
    new TextEncoder().encode(skHex),
  );
  await idbSet(RECORD, { salt, iv, ct });
}

/** Decrypt the stored key with `passphrase`. Throws 'bad-passphrase' on failure. */
export async function loadKey(passphrase) {
  const rec = await idbGet(RECORD);
  if (!rec) throw new Error('no-key');
  const aes = await deriveAesKey(passphrase, rec.salt);
  try {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: rec.iv }, aes, rec.ct);
    return new TextDecoder().decode(pt);
  } catch {
    throw new Error('bad-passphrase'); // wrong passphrase = auth-tag mismatch
  }
}

export async function hasStoredKey() {
  return (await idbGet(RECORD)) != null;
}

export async function clearKey() {
  await idbDel(RECORD);
}
