// Nested comment thread for the post detail view. Takes a flat list of the
// community's comments (each with parentEvent) and rebuilds the reply tree
// rooted at the post. Renders data only; publishing goes through onReply.

import { el, mount } from '../../lib/dom.js';
import { t } from '../../i18n/index.js';
import { isLoggedIn } from '../../app/session.js';
import { loadMore } from '../loadmore.js';
import { authHint } from '../authHint.js';
import { showAlert } from '../dialogs.js';
import { bylineBits, dot } from '../byline.js';
import { deleteButton } from '../deleteButton.js';
import { replyForm, makeToggle } from './replyForm.js';

const MAX_DEPTH = 1; // thread is two levels only: comment (0) + reply (1)

export function renderComments(post, comments, { me, creator, onReply, onDelete, page, onLoadMore }) {
  const container = el('section', { class: 'comments' });
  // Local copy of the thread: a reply is pushed here the moment it is signed
  // (pending), then confirmed or rolled back when the relay fan-out settles.
  const items = [...comments];
  const seen = new Set(comments.map((c) => c.id)); // dedup optimistic + paged rows
  const insert = (comment, accepted) => {
    const item = { ...comment, pending: true };
    seen.add(comment.id);
    items.push(item);
    render();
    accepted.then((count) => {
      const i = items.indexOf(item);
      if (i < 0) return;
      if (count > 0) items[i] = { ...item, pending: false };
      else items.splice(i, 1); // no relay stored it - roll the row back
      render();
      if (count === 0) showAlert(t('error.publish_failed'));
    });
  };
  // Local delete: a comment with replies becomes a tombstone in place so the
  // thread beneath it survives; a leaf comment is removed outright. Matches the
  // NIP-09 best-effort model: the row reflects the request, not a guarantee.
  const drop = (id) => {
    const i = items.findIndex((c) => c.id === id);
    if (i < 0) return;
    if (items.some((c) => c.parentEvent === id)) {
      items[i] = { ...items[i], deleted: true };
      return;
    }
    const { parentEvent } = items[i];
    items.splice(i, 1);
    // Deleting the last reply under a tombstoned parent orphans that tombstone,
    // so remove it too, cascading up until a live comment or a still-replied node.
    const parent = parentEvent && items.find((c) => c.id === parentEvent);
    if (parent && parent.deleted) drop(parentEvent);
  };
  const remove = (comment) => { drop(comment.id); render(); };
  const ctx = { me, creator, onReply, onDelete, insert, remove };
  // Older comments page in above the thread; re-sort so paged-in rows land in
  // chronological order among their siblings, not at the end of the flat list.
  const more = page && onLoadMore
    ? loadMore({
      page, seen, fetchPage: onLoadMore, label: t('comment.load_older'),
      onAppend: (older) => { items.push(...older); render(); },
    })
    : null;
  function render() {
    items.sort((a, b) => a.createdAt - b.createdAt);
    const byParent = groupByParent(items);
    // `items` is the whole community's flat thread; only the nodes reachable
    // from this post belong to it, so count the rebuilt rows, not the raw list.
    const rows = flatten(post.id, 0, byParent, ctx);
    for (const orphan of orphanRoots(post.id, items, byParent)) {
      rows.push(renderOrphanRoot(orphan, ctx), ...flatten(orphan.id, 1, byParent, ctx));
    }
    const heading = el('h2', { class: 'comments-head' }, t('comment.count', { count: rows.length }));
    const list = rows.length
      ? el('ul', { class: 'comment-list' }, rows)
      : el('p', { class: 'muted' }, t('comment.empty'));
    const composer = isLoggedIn()
      ? replyForm(post, ctx, t('comment.placeholder'), t('comment.submit'))
      : authHint();
    mount(container, [heading, more, list, composer]);
  }
  render();
  return container;
}

// Replies that declare this post as their thread root (E tag) but whose parent
// comment never reached this user's relays (relay sets need not overlap).
// Without this they would vanish silently; instead they surface at top level.
// Returns only the roots of each orphan subtree - descendants render beneath.
function orphanRoots(postId, items, byParent) {
  const reachable = new Set();
  const walk = (id) => {
    for (const c of byParent.get(id) ?? []) { reachable.add(c.id); walk(c.id); }
  };
  walk(postId);
  const orphanIds = new Set(
    items.filter((c) => c.rootEvent === postId && !reachable.has(c.id)).map((c) => c.id),
  );
  return items.filter((c) => orphanIds.has(c.id) && !orphanIds.has(c.parentEvent));
}

function renderOrphanRoot(comment, ctx) {
  const node = renderNode(comment, 0, ctx);
  node.prepend(el('p', { class: 'muted orphan-note' }, t('comment.orphan_note')));
  return node;
}

function groupByParent(comments) {
  const map = new Map();
  for (const c of comments) {
    if (!map.has(c.parentEvent)) map.set(c.parentEvent, []);
    map.get(c.parentEvent).push(c);
  }
  return map;
}

// Depth-first walk → flat array of <li>. Nesting is clamped to two levels:
// deeper events (from other clients) still render, pinned at the reply level.
function flatten(parentId, depth, byParent, ctx) {
  const rows = [];
  for (const comment of byParent.get(parentId) ?? []) {
    rows.push(renderNode(comment, depth, ctx));
    rows.push(...flatten(comment.id, depth + 1, byParent, ctx));
  }
  return rows;
}

function renderNode(comment, depth, ctx) {
  const level = Math.min(depth, MAX_DEPTH);
  if (comment.deleted) return tombstoneNode(level);
  // Replies to a reply attach to the top-level comment, so depth never exceeds 1.
  const parentId = level > 0 ? comment.parentEvent : comment.id;
  const slot = el('span', {});
  const toggle = isLoggedIn() ? makeToggle(slot, parentId, ctx) : null;

  // Clicking any comment body opens the reply composer (no explicit button).
  const body = el('div', {
    class: toggle ? 'post-body clickable' : 'post-body',
    onClick: toggle,
  }, comment.content);

  const content = [body, commentMeta(comment, ctx), slot];
  if (level === 0) return el('li', { class: 'comment' }, content);
  return el('li', { class: 'comment is-reply' }, [
    el('span', { class: 'reply-marker muted' }, '┗'),
    el('div', { class: 'reply-content' }, content),
  ]);
}

// A deleted comment that still has replies: keep its slot as a tombstone so the
// thread below it doesn't collapse or reparent.
function tombstoneNode(level) {
  const body = el('p', { class: 'muted comment-tombstone' }, t('comment.deleted'));
  if (level === 0) return el('li', { class: 'comment' }, body);
  return el('li', { class: 'comment is-reply' }, [
    el('span', { class: 'reply-marker muted' }, '┗'),
    el('div', { class: 'reply-content' }, body),
  ]);
}

function commentMeta(comment, ctx) {
  const bits = bylineBits(comment, ctx.creator);
  if (comment.pending) bits.push(dot(), el('span', {}, t('post.publishing')));
  else if (ctx.me && comment.pubkey === ctx.me) {
    bits.push(dot(), deleteControl(comment, ctx));
  }
  return el('div', { class: 'muted post-meta' }, bits);
}

function deleteControl(comment, ctx) {
  return deleteButton({
    labelKey: 'comment.delete',
    confirmKey: 'comment.delete_confirm',
    run: async () => {
      await ctx.onDelete(comment);
      ctx.remove(comment);
    },
  });
}
