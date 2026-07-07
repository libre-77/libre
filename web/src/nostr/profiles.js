// Author profile (kind 0) lookup with a small in-memory cache. Names only -
// libre stays plain, so we surface display name and nothing decorative.

import { KIND } from './kinds.js';
import { query, publish } from './pool.js';
import { sign } from './signer.js';
import { nip19 } from '../../vendor/nostr-tools.js';

const cache = new Map(); // pubkey -> { name }

/** Short, stable fallback label for a pubkey when no profile is found. */
export function shortName(pubkey) {
  return nip19.npubEncode(pubkey).slice(0, 12) + '…';
}

/** Fetch one pubkey's newest kind-0 metadata as a plain object ({} if none). */
export async function fetchProfile(pubkey) {
  const events = await query({ kinds: [KIND.METADATA], authors: [pubkey], limit: 1 });
  if (!events.length) return {};
  const newest = events.reduce((a, b) => (b.created_at > a.created_at ? b : a));
  try {
    return JSON.parse(newest.content) || {};
  } catch {
    return {};
  }
}

/** Publish the signer's kind-0 metadata. Refreshes the name cache on success. */
export async function publishProfile(meta) {
  const signed = await sign({ kind: KIND.METADATA, content: JSON.stringify(meta) });
  const accepted = await publish(signed);
  cache.set(signed.pubkey, { name: meta.name || meta.display_name || shortName(signed.pubkey) });
  return accepted;
}

/**
 * Resolve display names for many pubkeys at once. Returns Map<pubkey, name>.
 * Unknown authors fall back to a shortened npub.
 */
export async function fetchNames(pubkeys) {
  const out = new Map();
  const missing = [];
  for (const pk of new Set(pubkeys)) {
    if (cache.has(pk)) out.set(pk, cache.get(pk).name);
    else missing.push(pk);
  }
  if (missing.length) {
    const events = await query({ kinds: [KIND.METADATA], authors: missing });
    for (const ev of events) {
      let name = shortName(ev.pubkey);
      try {
        const meta = JSON.parse(ev.content);
        name = meta.name || meta.display_name || name;
      } catch {
        // malformed metadata - keep the fallback
      }
      cache.set(ev.pubkey, { name });
      out.set(ev.pubkey, name);
    }
  }
  // Cache misses too: repeat lookups (every publish and list render) must not
  // re-query relays for authors who simply have no kind-0 profile.
  for (const pk of missing) {
    if (!out.has(pk)) {
      cache.set(pk, { name: shortName(pk) });
      out.set(pk, shortName(pk));
    }
  }
  return out;
}
