// SPDX-License-Identifier: AGPL-3.0-or-later
// Shared author byline for post rows, post detail and comments:
// "by name [creator badge] · time-ago". Callers append their own trailing
// fragments (pending marker, delete control, ...). Renders data only.

import { el } from '../lib/dom.js';
import { t, getLocale } from '../i18n/index.js';
import { timeAgo } from '../lib/time.js';

/** The ' · ' separator span used between meta fragments. */
export function dot() {
  return el('span', {}, ' · ');
}

/** Byline fragments for a post/comment. `creator` marks the community creator. */
export function bylineBits(item, creator) {
  const bits = [el('span', {}, t('post.by', { name: item.authorName }))];
  if (creator && item.pubkey === creator) {
    bits.push(el('span', { class: 'creator-badge' }, t('post.creator_badge')));
  }
  bits.push(dot(), el('span', {}, timeAgo(item.createdAt, getLocale())));
  return bits;
}
