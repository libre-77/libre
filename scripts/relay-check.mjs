// SPDX-License-Identifier: AGPL-3.0-or-later
// Vet relays before adding them to DEFAULT_RELAYS (web/src/nostr/relays.js) or
// a personal relay list. A relay must not merely be reachable - it must:
//   1. accept open writes (OK true on EVENT),
//   2. answer queries (EOSE on REQ),
//   3. handle MANY CONCURRENT subscriptions on one connection. The app's
//      SimplePool multiplexes every query over a single connection per relay;
//      a relay that EOSEs only the first REQ (e.g. nostr-pub.wellorder.net,
//      measured 1/12) silently stalls every later query to the full pool
//      timeout and makes the whole app feel slow.
//
// Usage: node scripts/relay-check.mjs [wss://relay-a wss://relay-b ...]
//        (no args = check the current DEFAULT_RELAYS)
// Requires Node >= 22 (global WebSocket). Publishes only an ephemeral-kind
// event (20001), which relays acknowledge but never store.

import { finalizeEvent, generateSecretKey } from '../web/vendor/nostr-tools.js';
import { DEFAULT_RELAYS } from '../web/src/nostr/relays.js';

const TIMEOUT_MS = 6000;
const CONCURRENT_SUBS = 12;
const NOBODY = 'b'.repeat(64); // a pubkey with no kind-0, so EOSE is the only reply
const secretKey = generateSecretKey();

/** One relay, one connection: time connect, kind-0 REQ->EOSE, EVENT->OK. */
function checkBasics(url) {
  return new Promise((resolve) => {
    const out = { connect: null, eose: null, okMs: null, accepted: null, error: null };
    const t0 = Date.now();
    let ws;
    const finish = () => { clearTimeout(timer); try { ws.close(); } catch { /* already closed */ } resolve(out); };
    const timer = setTimeout(() => { out.error = out.error ?? 'timeout'; finish(); }, TIMEOUT_MS);
    try { ws = new WebSocket(url); } catch (err) { out.error = err.message; finish(); return; }
    ws.onerror = () => { if (out.eose === null || out.okMs === null) out.error = 'ws error'; finish(); };
    ws.onopen = () => {
      out.connect = Date.now() - t0;
      ws.send(JSON.stringify(['REQ', 'check', { kinds: [0], authors: [NOBODY], limit: 1 }]));
      const event = finalizeEvent(
        { kind: 20001, created_at: Math.floor(Date.now() / 1000), tags: [], content: 'libre relay check' },
        secretKey,
      );
      out.publishedAt = Date.now();
      ws.send(JSON.stringify(['EVENT', event]));
    };
    ws.onmessage = (msg) => {
      let frame;
      try { frame = JSON.parse(msg.data); } catch { return; }
      if (frame[0] === 'EOSE' && out.eose === null) out.eose = Date.now() - t0;
      if (frame[0] === 'OK' && out.okMs === null) { out.okMs = Date.now() - out.publishedAt; out.accepted = frame[2]; }
      if (out.eose !== null && out.okMs !== null) finish();
    };
  });
}

/** One connection, N concurrent REQs: count how many get an EOSE. */
function checkConcurrentSubs(url) {
  return new Promise((resolve) => {
    const eosed = new Set();
    let ws;
    const finish = () => { clearTimeout(timer); try { ws.close(); } catch { /* already closed */ } resolve(eosed.size); };
    const timer = setTimeout(finish, TIMEOUT_MS);
    try { ws = new WebSocket(url); } catch { resolve(0); return; }
    ws.onerror = finish;
    ws.onopen = () => {
      for (let i = 0; i < CONCURRENT_SUBS; i++) {
        ws.send(JSON.stringify(['REQ', `sub${i}`, { kinds: [0], authors: [NOBODY], limit: 1 }]));
      }
    };
    ws.onmessage = (msg) => {
      try {
        const frame = JSON.parse(msg.data);
        if (frame[0] === 'EOSE') eosed.add(frame[1]);
      } catch { /* non-JSON frame - ignore */ }
      if (eosed.size === CONCURRENT_SUBS) finish();
    };
  });
}

function verdict(basics, subs) {
  if (basics.error && basics.connect === null) return `FAIL unreachable (${basics.error})`;
  if (basics.accepted !== true) return 'FAIL rejects open writes';
  if (basics.eose === null) return 'FAIL no EOSE on REQ';
  if (subs < CONCURRENT_SUBS) return `FAIL concurrent subs ${subs}/${CONCURRENT_SUBS} (stalls pooled queries)`;
  return 'PASS';
}

const relays = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_RELAYS;
console.log(`checking ${relays.length} relay(s), ${CONCURRENT_SUBS} concurrent subs, ${TIMEOUT_MS}ms timeout\n`);

const results = await Promise.all(relays.map(async (url) => {
  const basics = await checkBasics(url);
  const subs = await checkConcurrentSubs(url);
  return { url, basics, subs };
}));

let failed = false;
for (const { url, basics, subs } of results) {
  const v = verdict(basics, subs);
  if (v !== 'PASS') failed = true;
  console.log(
    `${url.padEnd(36)} connect ${String(basics.connect ?? '-').padStart(5)}ms | ` +
    `EOSE ${String(basics.eose ?? '-').padStart(5)}ms | ` +
    `publish ${basics.okMs !== null ? basics.okMs + 'ms ok=' + basics.accepted : '-'} | ` +
    `subs ${subs}/${CONCURRENT_SUBS} | ${v}`,
  );
}
process.exit(failed ? 1 : 0);
