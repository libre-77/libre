// SPDX-License-Identifier: AGPL-3.0-or-later
// Event -> plain-shape parsers for NIP-72 communities. Split out of
// communities.js so each module stays under the 200-line ceiling (CLAUDE.md §4).

import { KIND, TAG, ROLE_MODERATOR } from './kinds.js';

/** Coordinate string for an addressable community: 34550:<pubkey>:<d>. */
export function communityAddr(c) {
  return `${KIND.COMMUNITY}:${c.pubkey}:${c.identifier}`;
}

/**
 * Placeholder Community for a coordinate whose definition event is missing
 * (never fetched, or deleted out-of-band). The coordinate pubkey IS the
 * creator, so highlighting and posting still work; only the display
 * name/description are unknown.
 */
export function placeholderCommunity(pubkey, identifier, createdAt = 0) {
  return {
    pubkey, identifier, name: identifier, description: '', image: '',
    moderators: [pubkey], createdAt, deleted: true,
  };
}

/** Parse a kind-34550 event into a Community shape. */
export function parseCommunity(ev) {
  const tag = (name) => ev.tags.find((t) => t[0] === name)?.[1] ?? '';
  const moderators = ev.tags
    .filter((t) => t[0] === TAG.PUBKEY && t[3] === ROLE_MODERATOR)
    .map((t) => t[1]);
  return {
    id: ev.id,
    pubkey: ev.pubkey, // community creator (implicit moderator)
    identifier: tag(TAG.IDENTIFIER),
    name: tag(TAG.NAME) || tag(TAG.IDENTIFIER),
    description: tag(TAG.DESCRIPTION),
    image: tag(TAG.IMAGE),
    moderators: moderators.length ? moderators : [ev.pubkey],
    createdAt: ev.created_at,
  };
}

/** Parse a kind-1111 comment into a Post shape. */
export function parsePost(ev) {
  const parentEvent = ev.tags.find((t) => t[0] === TAG.PARENT_EVENT)?.[1] ?? null;
  const rootEvent = ev.tags.find((t) => t[0] === TAG.ROOT_EVENT)?.[1] ?? null;
  const title = ev.tags.find((t) => t[0] === TAG.SUBJECT)?.[1] ?? '';
  return {
    id: ev.id,
    pubkey: ev.pubkey,
    title, // NIP-14 subject; '' when the author gave no title
    content: ev.content,
    createdAt: ev.created_at,
    parentEvent, // null => top-level post in the community; else a reply
    rootEvent, // top-level post this reply belongs to (null on old/foreign events)
  };
}
