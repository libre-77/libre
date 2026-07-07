// Orchestration layer. The router calls these; they call nostr/ and return
// plain data for ui/ to render. No DOM here, no protocol details leaking out.

import * as communities from '../nostr/communities.js';
import { fetchNames, fetchProfile, publishProfile } from '../nostr/profiles.js';
import { fetchReactions, publishReaction, removeReaction } from '../nostr/reactions.js';
import { uploadImage as blossomUpload } from '../nostr/media.js';
import { fetchDecryptedImage } from '../nostr/mediacrypt.js';
import { currentPubkey } from './session.js';

export const uploadImage = blossomUpload;
export const loadEncryptedImage = fetchDecryptedImage;

/**
 * A page of communities, newest first, each enriched with its founder's
 * display name: { items, hasMore, nextUntil }.
 */
export async function listCommunities(opts) {
  const { items, hasMore, nextUntil } = await communities.fetchCommunities(opts);
  const names = await fetchNames(items.map((c) => c.moderators[0]));
  return {
    items: items.map((c) => ({ ...c, moderatorName: names.get(c.moderators[0]) })),
    hasMore,
    nextUntil,
  };
}

/** One community by creator pubkey + identifier. */
export function getCommunity(pubkey, identifier) {
  return communities.fetchCommunity(pubkey, identifier);
}

/**
 * Top-level posts for a community, each enriched with the author's display name.
 * Replies are excluded from the top list (parentEvent === null).
 */
export async function listPosts(community, opts) {
  const { items, hasMore, nextUntil } = await communities.fetchPosts(community, opts);
  const top = items.filter((p) => p.parentEvent === null);
  const [names, reactions] = await Promise.all([
    fetchNames(top.map((p) => p.pubkey)),
    fetchReactions(top.map((p) => p.id), currentPubkey()),
  ]);
  const withMeta = top.map((p) => ({
    ...p, authorName: names.get(p.pubkey), reactions: reactions.get(p.id),
  }));
  return { items: withMeta, hasMore, nextUntil };
}

/** One post by event id, enriched with the author's name and reaction tally. */
export async function getPost(id) {
  const post = await communities.fetchPost(id);
  if (!post) return null;
  const [names, reactions] = await Promise.all([
    fetchNames([post.pubkey]),
    fetchReactions([id], currentPubkey()),
  ]);
  return { ...post, authorName: names.get(post.pubkey), reactions: reactions.get(id) };
}

/**
 * Publish an up/down reaction to a post. Returns { id, accepted }: the new
 * reaction event id (kept so the UI can cancel it) and a Promise of the
 * relay-accept count for confirm/rollback.
 */
export function react(post, direction) {
  return publishReaction(post, direction);
}

/** Cancel a reaction by its event id. Returns a Promise of the relay-accept count. */
export async function unreact(reactionId) {
  const { accepted } = await removeReaction(reactionId);
  return accepted;
}

/**
 * Flat list of every comment in a community, oldest first, each enriched with
 * the author's name. The UI rebuilds the nested reply tree via parentEvent.
 */
export async function listThread(community, opts) {
  const { items, hasMore, nextUntil } = await communities.fetchThread(community, opts);
  const names = await fetchNames(items.map((c) => c.pubkey));
  return { items: items.map((c) => ({ ...c, authorName: names.get(c.pubkey) })), hasMore, nextUntil };
}

/** One pubkey's kind-0 profile (plain object, {} if none). */
export function getProfile(pubkey) {
  return fetchProfile(pubkey);
}

/** Publish the current identity's kind-0 profile. Returns accepted relay count. */
export function saveProfile(meta) {
  return publishProfile(meta);
}

/**
 * Publish a top-level post. Resolves as soon as the event is signed and named
 * so the UI can insert it optimistically; `accepted` is a Promise of the
 * relay-accept count that settles when the fan-out finishes.
 */
export async function createPost(community, content, title) {
  const { post, accepted } = await communities.publishPost(community, content, title);
  const names = await fetchNames([post.pubkey]);
  return { post: { ...post, authorName: names.get(post.pubkey) }, accepted };
}

/** Publish a reply. Same optimistic { post, accepted: Promise } shape as createPost. */
export async function createReply(community, rootPost, parentPost, content) {
  const { post, accepted } = await communities.publishReply(community, rootPost, parentPost, content);
  const names = await fetchNames([post.pubkey]);
  return { post: { ...post, authorName: names.get(post.pubkey) }, accepted };
}

export function deletePost(post) {
  return communities.deletePost(post);
}

export function newCommunity(data) {
  return communities.createCommunity(data);
}
