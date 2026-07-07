// SPDX-License-Identifier: AGPL-3.0-or-later
// Up/down reaction controls (NIP-25). Renders two vote buttons with counts and
// updates optimistically; the router-supplied `onReact` publishes and returns a
// Promise of the accepting-relay count so a total failure rolls the vote back.
// Renders data only - no relays/protocol here (CLAUDE.md §4).

import { el, mount } from '../lib/dom.js';
import { t } from '../i18n/index.js';
import { isLoggedIn } from '../app/session.js';

const UP = 'up';
const DOWN = 'down';
const ZERO = { up: 0, down: 0, mine: null, mineIds: [] };

/**
 * Up/down bar for one post. `onReact(direction)` → { id, accepted } and
 * `onUnreact(reactionId)` → Promise<number>, both giving the accepting-relay
 * count. Clicking your active vote cancels it; the other direction switches.
 * Logged-out users see the counts but can't vote.
 */
export function reactionBar(post, onReact, onUnreact) {
  const state = { ...ZERO, ...post.reactions };
  const bar = el('span', { class: 'reactions' });
  const cbs = { onReact, onUnreact, render: null };
  cbs.render = () => mount(bar, [
    voteButton(UP, '▲', state.up, state, cbs),
    voteButton(DOWN, '▼', state.down, state, cbs),
  ]);
  cbs.render();
  return bar;
}

// Glyph and count live inside one button so clicking the number votes too.
function voteButton(dir, glyph, count, state, cbs) {
  const active = state.mine === dir;
  const btn = el('button', {
    class: `react-btn react-${dir}${active ? ' active' : ''}`,
    type: 'button',
    'aria-label': t(active ? 'react.cancel' : dir === UP ? 'react.up' : 'react.down'),
    disabled: isLoggedIn() ? null : 'true',
  }, orderedParts(dir, glyph, count));
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    if (!isLoggedIn()) return;
    if (active) cancelVote(state, cbs);
    else castVote(state, dir, cbs);
  });
  return btn;
}

// Cast (or switch to) a vote: reflect it immediately, remember the new event id
// for a later cancel, roll back if no relay stored it. Switching direction also
// deletes the superseded reaction so only one live vote per user ever exists -
// otherwise the old vote (kept on relays that ignore NIP-09) resurfaces on the
// next fetch and cancelling the new one appears to flip the vote back.
async function castVote(state, dir, cbs) {
  const prev = { ...state };
  const superseded = state.mineIds; // every prior reaction of mine on this post
  applyVote(state, dir);
  cbs.render();
  try {
    const { id, accepted } = await cbs.onReact(dir);
    state.mineIds = [id];
    if (!(await accepted)) { rollback(state, prev, cbs.render); return; }
    dropAll(superseded, cbs); // best-effort: clear the old pile so it can't resurface
  } catch {
    rollback(state, prev, cbs.render);
  }
}

// Cancel the vote by deleting every reaction of mine on this post (best-effort,
// NIP-09). Deleting the whole pile - not just the newest - keeps a stale older
// vote from resurfacing as the newest on the next fetch.
async function cancelVote(state, cbs) {
  const prev = { ...state };
  const ids = state.mineIds;
  removeVote(state);
  cbs.render();
  if (!ids.length) return; // optimistic vote not yet confirmed - nothing to delete
  try {
    const counts = await Promise.all(ids.map((id) => Promise.resolve(cbs.onUnreact(id)).catch(() => 0)));
    if (counts.every((c) => !c)) rollback(state, prev, cbs.render); // no relay dropped any
  } catch {
    rollback(state, prev, cbs.render);
  }
}

// Fire-and-forget deletions for superseded reactions; failures are ignored since
// the new vote already renders and relay deletion is best-effort anyway.
function dropAll(ids, cbs) {
  for (const id of ids) Promise.resolve(cbs.onUnreact(id)).catch(() => {});
}

// Mirror the two buttons around the center: up reads "1 ▲", down reads "▼ 0".
function orderedParts(dir, glyph, count) {
  const g = el('span', { class: 'react-glyph' }, glyph);
  const n = el('span', { class: 'react-count' }, String(count));
  return dir === UP ? [n, g] : [g, n];
}

// Reflect the next tally: drop the user's old vote (if any), add the new one.
function applyVote(state, dir) {
  if (state.mine === UP) state.up--;
  else if (state.mine === DOWN) state.down--;
  if (dir === UP) state.up++; else state.down++;
  state.mine = dir;
}

// Remove the user's vote: decrement its side and clear the "mine" markers.
function removeVote(state) {
  if (state.mine === UP) state.up--;
  else if (state.mine === DOWN) state.down--;
  state.mine = null;
  state.mineIds = [];
}

function rollback(state, prev, render) {
  Object.assign(state, prev);
  render();
}
