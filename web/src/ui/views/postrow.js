// SPDX-License-Identifier: AGPL-3.0-or-later
// One board-list row: title link + up-score + author + time. Split out of
// community.js to keep both files under the 200-line ceiling (CLAUDE.md §4).
// Renders data only; the whole row opens the post.

import { el } from '../../lib/dom.js';
import { t } from '../../i18n/index.js';
import { bylineBits, dot } from '../byline.js';

// Posts by the community creator (matched by pubkey) are highlighted.
export function renderPostRow(post, onOpenPost, creator) {
  const byCreator = post.pubkey === creator;
  const title = el('a', { class: 'post-row-title', href: '#' }, post.title || t('post.untitled'));
  const metaBits = [netScore(post.reactions), dot(), ...bylineBits(post, creator)];
  if (post.pending) metaBits.push(dot(), el('span', {}, t('post.publishing')));
  const meta = el('span', { class: 'muted post-row-meta' }, metaBits);
  return el('li', {
    class: byCreator ? 'post-row by-creator' : 'post-row',
    onClick: (e) => { e.preventDefault(); onOpenPost(post); },
  }, [title, meta]);
}

// The row shows the net score (up − down): ▲N green when positive, ▼N red when
// negative, ▲0 grey at zero. Always shown so every post reads consistently.
function netScore(reactions) {
  const net = (reactions?.up ?? 0) - (reactions?.down ?? 0);
  if (net < 0) return el('span', { class: 'post-row-score down' }, t('react.score_down', { count: -net }));
  const cls = net === 0 ? 'post-row-score zero' : 'post-row-score';
  return el('span', { class: cls }, t('react.score', { count: net }));
}
