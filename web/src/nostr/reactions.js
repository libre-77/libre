// SPDX-License-Identifier: AGPL-3.0-or-later
// NIP-25 reactions (kind 7). libre exposes exactly two: up (+) and down (-).
// Emoji/other reactions on the wire are ignored so the tally stays a clean
// two-way score. The only module that reads/writes kind-7 events.

import { KIND, TAG } from './kinds.js';
import { query, publish } from './pool.js';
import { sign } from './signer.js';

// Wire symbols (NIP-25 content). Kept private: callers use the semantic
// 'up'/'down' tokens so upper layers never handle raw reaction glyphs.
const UP = '+';
const DOWN = '-';

/**
 * Tally reactions → Map<eventId, {up, down, mine, mineId}>. `mine` is
 * 'up' | 'down' | null; `mineId` is the current user's reaction event id (for
 * cancelling it) or null. A user's newest kind-7 is their current vote,
 * so we keep one reaction per (event, pubkey): re-voting or switching direction
 * overwrites, matching what the buttons show. `me` (hex pubkey or null) picks
 * whose vote is `mine`.
 */
export async function fetchReactions(eventIds, me = null) {
  if (!eventIds.length) return new Map();
  const events = await query({ kinds: [KIND.REACTION], '#e': eventIds });
  return tallyReactions(events, eventIds, me);
}

/**
 * Pure tally of raw kind-7 events → Map<eventId, {up, down, mine, mineIds}>.
 * Split from the relay fetch so it is unit-testable (CLAUDE.md §8). Foreign
 * reaction glyphs (emoji, empty) are ignored; only the newest vote per
 * (event, pubkey) is counted. `mineIds` lists EVERY reaction the current user
 * left on that event (not just the newest) so the UI can delete the whole pile
 * on cancel - past testing/double-votes leave stale kind-7 events behind.
 */
export function tallyReactions(events, eventIds, me = null) {
  const wanted = new Set(eventIds);
  const perEvent = new Map(); // eventId -> (pubkey -> newest reaction event)
  const mineByEvent = new Map(); // eventId -> [all of the current user's reaction ids]
  for (const ev of events) {
    if (ev.content !== UP && ev.content !== DOWN) continue; // ignore emoji/other
    const target = ev.tags.find((tag) => tag[0] === TAG.PARENT_EVENT)?.[1];
    if (!target || !wanted.has(target)) continue;
    let byPub = perEvent.get(target);
    if (!byPub) perEvent.set(target, (byPub = new Map()));
    const prev = byPub.get(ev.pubkey);
    if (!prev || ev.created_at > prev.created_at) byPub.set(ev.pubkey, ev);
    if (me && ev.pubkey === me) {
      let ids = mineByEvent.get(target);
      if (!ids) mineByEvent.set(target, (ids = []));
      ids.push(ev.id);
    }
  }
  const out = new Map();
  for (const id of wanted) {
    let up = 0, down = 0, mine = null;
    for (const [pk, ev] of perEvent.get(id) ?? []) {
      const dir = ev.content === UP ? 'up' : 'down';
      if (dir === 'up') up++; else down++;
      if (me && pk === me) mine = dir;
    }
    out.set(id, { up, down, mine, mineIds: mineByEvent.get(id) ?? [] });
  }
  return out;
}

/**
 * Publish an up/down reaction to a post (NIP-25 kind 7). `direction` is the
 * semantic 'up' or 'down'; the wire glyph stays private to this module. Returns
 * { id, accepted }: the new reaction event id (so the UI can later cancel it)
 * and a Promise of the relay-accept count (the optimistic shape used elsewhere).
 */
export async function publishReaction(post, direction) {
  const content = direction === 'up' ? UP : DOWN;
  const signed = await sign({
    kind: KIND.REACTION,
    content,
    tags: [
      [TAG.PARENT_EVENT, post.id], // e: event being reacted to
      [TAG.PUBKEY, post.pubkey], // p: its author
      [TAG.PARENT_KIND, String(KIND.COMMENT)], // k: reacted event's kind
    ],
  });
  return { id: signed.id, accepted: publish(signed) };
}

/**
 * Cancel a reaction: request deletion of the user's own kind-7 event (NIP-09,
 * kind 5). Best-effort - relays that honor it drop the reaction; others keep it,
 * and a vote cast before a since-deleted switch may resurface on refetch. Returns
 * { accepted }, a Promise of the relay-accept count.
 */
export async function removeReaction(reactionId) {
  const signed = await sign({
    kind: KIND.DELETION,
    content: '',
    tags: [
      [TAG.PARENT_EVENT, reactionId], // e: the reaction to delete
      [TAG.PARENT_KIND, String(KIND.REACTION)], // k: its kind (NIP-09)
    ],
  });
  return { accepted: publish(signed) };
}
