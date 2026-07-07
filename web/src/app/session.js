// Auth/session state. Wraps nostr/signer and notifies subscribers on change.
// UI reads session through here; it never touches signer or keys directly.

import * as signer from '../nostr/signer.js';
import { nip19 } from '../../vendor/nostr-tools.js';

let pubkey = null;
let locked = false; // encrypted key exists but not yet unlocked this session
const listeners = new Set();

/** Resolve any existing identity (extension or unlocked key) at boot. */
export async function init() {
  pubkey = await signer.getPubkey();
  locked = await signer.isLocked();
  emit();
}

export function currentPubkey() {
  return pubkey;
}

export function isLoggedIn() {
  return pubkey !== null;
}

/** A passphrase-protected identity is stored but not unlocked. */
export function isLocked() {
  return locked;
}

export function hasExtension() {
  return signer.hasExtension();
}

/** Adopt the NIP-07 extension identity. */
export async function loginExtension() {
  pubkey = await signer.getPubkey();
  locked = false;
  emit();
  return pubkey;
}

/** Create a fresh local identity protected by `passphrase`; returns its npub. */
export async function createLocal(passphrase) {
  const npub = await signer.createLocalIdentity(passphrase);
  pubkey = await signer.getPubkey();
  locked = false;
  emit();
  return npub;
}

/** Derive the npub for an `nsec` without storing anything. Throws on bad nsec. */
export function npubFromNsec(nsec) {
  return signer.npubFromNsec(nsec);
}

/** The unlocked local key as `nsec…` for backup, or null (extension / locked). */
export function currentNsec() {
  return signer.exportNsec();
}

/** Re-verify `passphrase` against the stored key and return its `nsec…` for backup. */
export function exportNsecWithPassphrase(passphrase) {
  return signer.exportNsecWithPassphrase(passphrase);
}

/** Import an existing `nsec` identity, encrypt under `passphrase`; returns its npub. */
export async function importLocal(nsec, passphrase) {
  const npub = await signer.importLocalIdentity(nsec, passphrase);
  pubkey = await signer.getPubkey();
  locked = false;
  emit();
  return npub;
}

/** Unlock the stored identity with `passphrase`. Throws on wrong passphrase. */
export async function unlock(passphrase) {
  await signer.unlock(passphrase);
  pubkey = await signer.getPubkey();
  locked = false;
  emit();
  return pubkey;
}

/** Permanently delete the local identity (no effect on an extension login). */
export async function logout() {
  await signer.logoutLocal();
  pubkey = null;
  locked = false;
  emit();
}

/** Current identity as npub, or null. */
export function currentNpub() {
  return pubkey ? nip19.npubEncode(pubkey) : null;
}

export function subscribe(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function emit() {
  for (const cb of listeners) cb(pubkey);
}
