// Identity + event signing. Two paths, one stable interface so app/ never
// branches on which is in use:
//   1. NIP-07 browser extension (preferred - key never touches this app).
//   2. A local identity: the nsec is encrypted under a passphrase and stored as
//      ciphertext in IndexedDB (see keystore.js). Unlocking decrypts it into
//      memory for the session only - plaintext is never written to disk.
//
// Legacy note: earlier builds stored the nsec as plaintext in localStorage. On
// load we wipe any such key so that exposure can't linger; those users simply
// re-create a passphrase-protected identity.

import {
  finalizeEvent,
  getPublicKey,
  generateSecretKey,
  nip19,
} from '../../vendor/nostr-tools.js';
import * as keystore from './keystore.js';
import { nowSeconds } from '../lib/time.js';

const LEGACY_KEY = 'libre.localKey';

let unlockedSk = null; // hex nsec held in memory while unlocked; never persisted

// Remove any plaintext key left by older builds (one-time cleanup).
try {
  if (typeof localStorage !== 'undefined' && localStorage.getItem(LEGACY_KEY)) {
    localStorage.removeItem(LEGACY_KEY);
  }
} catch {
  /* storage unavailable */
}

/** @returns {boolean} whether a NIP-07 extension is available. */
export function hasExtension() {
  return typeof window !== 'undefined' && !!window.nostr;
}

/** True when an encrypted local key exists but is not yet unlocked this session. */
export async function isLocked() {
  if (hasExtension() || unlockedSk) return false;
  return keystore.hasStoredKey();
}

/** Current pubkey (hex), or null if logged out / still locked. */
export async function getPubkey() {
  if (hasExtension()) return window.nostr.getPublicKey();
  return unlockedSk ? getPublicKey(hexToBytes(unlockedSk)) : null;
}

/** Generate a local identity, encrypt it under `passphrase`, store it, unlock it. */
export async function createLocalIdentity(passphrase) {
  const sk = generateSecretKey();
  const skHex = bytesToHex(sk);
  await keystore.saveKey(skHex, passphrase);
  unlockedSk = skHex;
  return nip19.npubEncode(getPublicKey(sk));
}

/** Decode an `nsec…` to its secret-key bytes. Throws 'bad-nsec' if malformed. */
function decodeNsec(nsec) {
  try {
    const decoded = nip19.decode(nsec.trim());
    if (decoded.type !== 'nsec') throw new Error('bad-nsec');
    return decoded.data; // Uint8Array secret key
  } catch {
    throw new Error('bad-nsec');
  }
}

/** Derive the npub for an `nsec` without storing anything. Throws 'bad-nsec'. */
export function npubFromNsec(nsec) {
  return nip19.npubEncode(getPublicKey(decodeNsec(nsec)));
}

/**
 * Import an existing identity from an `nsec…` string, encrypt it under
 * `passphrase`, store it, and unlock it. Throws 'bad-nsec' on a malformed key.
 */
export async function importLocalIdentity(nsec, passphrase) {
  const sk = decodeNsec(nsec);
  const skHex = bytesToHex(sk);
  await keystore.saveKey(skHex, passphrase);
  unlockedSk = skHex;
  return nip19.npubEncode(getPublicKey(sk));
}

/** Decrypt the stored key into memory for this session. Throws on bad passphrase. */
export async function unlock(passphrase) {
  unlockedSk = await keystore.loadKey(passphrase);
  return getPublicKey(hexToBytes(unlockedSk));
}

/**
 * Reveal the unlocked local key as an `nsec…` for backup. Returns null when no
 * local key is unlocked (e.g. a NIP-07 extension holds the key - nothing to
 * export). This is the ONLY value that can restore the account elsewhere.
 */
export function exportNsec() {
  return unlockedSk ? nip19.nsecEncode(hexToBytes(unlockedSk)) : null;
}

/**
 * Reveal the stored local key as an `nsec…` only after re-verifying `passphrase`
 * against the ciphertext on disk. Throws 'bad-passphrase' on a wrong passphrase
 * and 'no-key' when nothing is stored. Used to gate the backup surface so a held
 * unlock alone can't expose the key.
 */
export async function exportNsecWithPassphrase(passphrase) {
  const skHex = await keystore.loadKey(passphrase);
  return nip19.nsecEncode(hexToBytes(skHex));
}

/** Drop the in-memory key (stays encrypted on disk; re-unlock with passphrase). */
export function lock() {
  unlockedSk = null;
}

/** Permanently delete the local identity (does not affect a NIP-07 extension). */
export async function logoutLocal() {
  unlockedSk = null;
  await keystore.clearKey();
}

/**
 * Sign an unsigned event template ({ kind, content, tags, created_at }).
 * Uses the extension when present, else the unlocked local key.
 */
export async function sign(template) {
  const ev = { created_at: nowSeconds(), tags: [], content: '', ...template };
  if (hasExtension()) return window.nostr.signEvent(ev);
  if (!unlockedSk) throw new Error('locked');
  return finalizeEvent(ev, hexToBytes(unlockedSk));
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

function bytesToHex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}
