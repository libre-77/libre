// NIP-72 community domain logic. The only module that constructs/reads community
// and post events. Returns plain shapes (nostr/types.js), never raw events upward.

import { KIND, TAG, NAMESPACE } from './kinds.js';
import { query, publish } from './pool.js';
import { sign } from './signer.js';
import { communityAddr, parseCommunity, parsePost, placeholderCommunity } from './parse.js';
import { windowed, pageCursor } from './paging.js';

export { communityAddr };

/**
 * Fetch communities across relays. Discovery is activity-based, not just
 * definition-based: we list both live kind-34550 definitions AND coordinates
 * that only have posts. This way a community whose definition was deleted (e.g.
 * by a hostile creator) stays discoverable through its posts, flagged deleted,
 * instead of vanishing from the list while its content lives on.
 */
export async function fetchCommunities({ limit = 100, until } = {}) {
  const [defs, posts] = await Promise.all([
    query(windowed({ kinds: [KIND.COMMUNITY], '#t': [NAMESPACE], limit }, until)),
    query(windowed({ kinds: [KIND.COMMENT], '#t': [NAMESPACE], limit }, until)),
  ]);
  const byAddr = new Map(); // coordinate -> Community, newest definition wins
  for (const ev of defs) {
    const c = parseCommunity(ev);
    const key = communityAddr(c);
    c.addr = key; // stable dedup key so the UI can merge pages without nostr/
    const prev = byAddr.get(key);
    if (!prev || c.createdAt > prev.createdAt) byAddr.set(key, c);
  }
  // Coordinates seen only in posts (no live definition) → deleted communities.
  const orphanTime = new Map();
  for (const ev of posts) {
    const addr = ev.tags.find((tag) => tag[0] === TAG.ROOT_ADDRESS)?.[1];
    if (!addr || byAddr.has(addr)) continue;
    orphanTime.set(addr, Math.max(orphanTime.get(addr) ?? 0, ev.created_at));
  }
  for (const [addr, ts] of orphanTime) {
    const c = communityFromAddr(addr, ts);
    if (c) { c.addr = addr; byAddr.set(addr, c); }
  }
  const items = [...byAddr.values()].sort((a, b) => b.createdAt - a.createdAt);
  // Either stream hitting its limit means older events may remain; page from the
  // oldest raw event so both definitions and orphan posts keep coming.
  const all = [...defs, ...posts];
  const nextUntil = all.reduce((m, ev) => Math.min(m, ev.created_at), Infinity);
  return {
    items,
    hasMore: defs.length >= limit || posts.length >= limit,
    nextUntil: all.length ? nextUntil : null,
  };
}

/** Build a placeholder Community from a coordinate whose definition is gone. */
function communityFromAddr(addr, createdAt) {
  const parts = addr.split(':');
  if (parts[0] !== String(KIND.COMMUNITY) || parts.length < 3) return null;
  // A d-tag may itself contain ':', so rejoin everything after the pubkey.
  return placeholderCommunity(parts[1], parts.slice(2).join(':'), createdAt);
}

// Community definitions rarely change; cache them for the session so repeat
// visits (list → post → back) render instantly instead of re-querying relays.
const communityCache = new Map(); // addr -> Community

/** Fetch a single community by coordinate (34550:pubkey:d). Cached per session. */
export async function fetchCommunity(pubkey, identifier) {
  const addr = communityAddr({ pubkey, identifier });
  if (communityCache.has(addr)) return communityCache.get(addr);
  const events = await query({
    kinds: [KIND.COMMUNITY], authors: [pubkey], '#d': [identifier], limit: 1,
  });
  const community = events.length ? parseCommunity(events[0]) : null;
  if (community) communityCache.set(addr, community);
  return community;
}

/** Fetch a single post by event id. Returns a Post shape or null. */
export async function fetchPost(id) {
  const events = await query({ kinds: [KIND.COMMENT], ids: [id], limit: 1 });
  return events.length ? parsePost(events[0]) : null;
}

/**
 * Fetch every comment in a community (flat). Each carries parentEvent, so the
 * UI can rebuild the nested reply tree. Top-level posts (parentEvent === null)
 * are excluded - callers want the comments only.
 */
export async function fetchThread(community, { limit = 500, until } = {}) {
  const addr = communityAddr(community);
  const events = await query(windowed({ kinds: [KIND.COMMENT], '#A': [addr], limit }, until));
  const items = events
    .map(parsePost)
    .filter((p) => p.parentEvent !== null)
    .sort((a, b) => a.createdAt - b.createdAt); // oldest first, thread order
  return { items, ...pageCursor(events, limit) };
}

/** Fetch discussion for a community: top-level posts (and replies) via NIP-22. */
export async function fetchPosts(community, { limit = 100, until } = {}) {
  const addr = communityAddr(community);
  const events = await query(windowed({ kinds: [KIND.COMMENT], '#A': [addr], limit }, until));
  const items = events.map(parsePost).sort((a, b) => b.createdAt - a.createdAt);
  return { items, ...pageCursor(events, limit) };
}

/** Publish a top-level post to a community (NIP-22 comment scoped to the community). */
export async function publishPost(community, content, title = '') {
  const addr = communityAddr(community);
  const tags = [
    [TAG.ROOT_ADDRESS, addr],
    [TAG.ROOT_KIND, String(KIND.COMMUNITY)],
    [TAG.PARENT_KIND, String(KIND.COMMUNITY)],
    ['t', NAMESPACE], // namespace marker so the community stays discoverable via its posts
  ];
  if (title) tags.push([TAG.SUBJECT, title]);
  const template = { kind: KIND.COMMENT, content, tags };
  const signed = await sign(template);
  // Resolve at sign time so the UI can render the post immediately; the relay
  // fan-out keeps running and `accepted` (a Promise of the accept count)
  // settles when every relay has answered or failed.
  return { post: parsePost(signed), accepted: publish(signed) };
}

/**
 * Publish a reply within a community. `rootPost` is the top-level post whose
 * thread the reply belongs to; `parentPost` is the direct parent (the post
 * itself for a comment, a comment for a nested reply).
 */
export async function publishReply(community, rootPost, parentPost, content) {
  const addr = communityAddr(community);
  const template = {
    kind: KIND.COMMENT,
    content,
    tags: [
      [TAG.ROOT_ADDRESS, addr],
      [TAG.ROOT_KIND, String(KIND.COMMUNITY)],
      // Thread root, so the reply stays attributable to its post even when the
      // parent comment never reaches this user's relays (see kinds.js).
      [TAG.ROOT_EVENT, rootPost.id],
      [TAG.PARENT_EVENT, parentPost.id],
      [TAG.PARENT_KIND, String(KIND.COMMENT)],
      ['t', NAMESPACE], // namespace marker (keeps activity-based discovery working)
    ],
  };
  const signed = await sign(template);
  // Same optimistic shape as publishPost: `accepted` is a Promise.
  return { post: parsePost(signed), accepted: publish(signed) };
}

/**
 * Request deletion of one of your own events (NIP-09, kind 5). Best-effort:
 * relays that honor NIP-09 drop the referenced event; others keep it. On a
 * censorship-resistant network deletion is never guaranteed.
 */
export async function deletePost(post) {
  const signed = await sign({
    kind: KIND.DELETION,
    content: '',
    tags: [
      [TAG.PARENT_EVENT, post.id], // e-tag: the event to delete
      [TAG.PARENT_KIND, String(KIND.COMMENT)], // k-tag: its kind (NIP-09)
    ],
  });
  const accepted = await publish(signed);
  return { accepted };
}

// Note: there is deliberately NO deleteCommunity. A community must outlive its
// creator's control: if the creator is coerced or malicious, they must not be
// able to erase the whole board and silence its members. Even if someone crafts
// a NIP-09 deletion for the kind-34550 event out-of-band, the member posts (and
// this app) survive: the board is rendered from the posts' #A coordinate, not
// from the definition event (see the router's deleted-community fallback).

/** Create a new community (kind 34550). Author becomes the first moderator. */
export async function createCommunity({ identifier, name, description, image }) {
  const tags = [
    [TAG.IDENTIFIER, identifier],
    [TAG.NAME, name],
    ['t', NAMESPACE], // libre namespace marker (see kinds.js NAMESPACE)
  ];
  if (description) tags.push([TAG.DESCRIPTION, description]);
  if (image) tags.push([TAG.IMAGE, image]);
  const signed = await sign({ kind: KIND.COMMUNITY, content: '', tags });
  const accepted = await publish(signed);
  const community = parseCommunity(signed);
  // Seed the session cache: navigating into the new board must not depend on
  // relays having propagated the definition yet.
  communityCache.set(communityAddr(community), community);
  return { community, accepted };
}
