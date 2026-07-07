// The single relay-pool singleton (the one allowed singleton, CLAUDE.md §4).
// Wraps nostr-tools SimplePool with query/publish helpers that tolerate any
// subset of relays being unreachable. No app or UI concerns here.

import { SimplePool } from '../../vendor/nostr-tools.js';
import { getRelays } from './relays.js';

let pool = null;

function getPool() {
  if (!pool) pool = new SimplePool();
  return pool;
}

/**
 * Query relays for events matching a single `filter` object, de-duplicated by
 * id. Resolves as soon as every relay signals end-of-stored-events (EOSE), and
 * falls back to `timeout` ms so an unresponsive relay can never stall the UI.
 * Note: this nostr-tools version takes ONE filter object (not an array).
 * @returns {Promise<Array>} events (unordered)
 */
export function query(filter, { timeout = 4000, relays = getRelays() } = {}) {
  return new Promise((resolve) => {
    const byId = new Map();
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      sub.close();
      resolve([...byId.values()]);
    };
    const sub = getPool().subscribeMany(relays, filter, {
      onevent(ev) {
        if (!byId.has(ev.id)) byId.set(ev.id, ev);
      },
      oneose() {
        finish(); // all relays returned their stored events - no need to wait out the timeout
      },
    });
    const timer = setTimeout(finish, timeout);
  });
}

/**
 * Publish a signed event to all relays. Resolves with the count of relays that
 * accepted it. Never rejects on partial failure - censorship resistance means
 * one accepting relay is success.
 */
export async function publish(signedEvent, { relays = getRelays() } = {}) {
  const results = await Promise.allSettled(getPool().publish(relays, signedEvent));
  // This nostr-tools version RESOLVES (not rejects) an unreachable relay with a
  // "connection failure: …" string. Count only genuine relay OKs, otherwise the
  // accept count overstates replication and a total failure looks like success.
  return results.filter(
    (r) => r.status === 'fulfilled' && !String(r.value ?? '').startsWith('connection failure'),
  ).length;
}
