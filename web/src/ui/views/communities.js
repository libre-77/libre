// Community list view. Pure render: given data + an onOpen callback, returns DOM.
// No fetching, no protocol (CLAUDE.md §4).

import { el, mount } from '../../lib/dom.js';
import { t } from '../../i18n/index.js';
import { nowSeconds } from '../../lib/time.js';
import { communityRef } from '../../app/communityRef.js';
import { loadMore } from '../loadmore.js';
import { starToggle } from '../star.js';

export function renderCommunities(list, { onOpen, page, onLoadMore, recent = [], favorites = [], onToggleFavorite }) {
  const header = el('div', { class: 'view-head' }, [
    el('h1', {}, t('community.list.title')),
    el('a', { class: 'action', href: '#/new' }, t('nav.new_community')),
  ]);

  if (!list.length) {
    return el('section', {}, [header, el('p', { class: 'muted' }, t('community.list.empty'))]);
  }

  const recentBlock = recent.length ? renderRecent(recent, onOpen) : null;

  // Search filters the client-side accumulated list only (initial page + every
  // page pulled in via "load more"), not the whole network - see CLAUDE.md §2
  // (no server-side logic to search relays for us).
  let items = list.slice();
  let query = '';
  let starred = favorites.slice(); // {addr,pubkey,identifier,name}, most-starred-first

  const starredWrap = el('div', {});
  const ul = el('ul', { class: 'community-list' });

  const renderRows = () => {
    const q = query.trim().toLowerCase();
    const shown = q
      ? items.filter((c) => c.name.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q))
      : items;
    const favAddrs = new Set(starred.map((c) => c.addr));
    mount(ul, shown.map((c) => communityRow(c, onOpen, favAddrs.has(c.addr), toggleStar)));
  };
  const renderStarred = () => {
    mount(starredWrap, starred.length ? renderFavorites(starred, onOpen, toggleStar) : null);
  };

  function toggleStar(c) {
    const nowStarred = onToggleFavorite(c);
    starred = nowStarred
      ? [communityRef(c), ...starred]
      : starred.filter((f) => f.addr !== c.addr);
    renderStarred();
    renderRows();
    return nowStarred;
  }

  renderRows();
  renderStarred();

  const search = el('input', {
    type: 'search',
    class: 'input community-search',
    placeholder: t('community.search.placeholder'),
    onInput: (e) => { query = e.target.value; renderRows(); },
  });

  const append = (fresh) => { items.push(...fresh); renderRows(); };
  const more = page && onLoadMore
    ? loadMore({
      page,
      seen: new Set(items.map((c) => c.addr)),
      keyOf: (c) => c.addr,
      fetchPage: onLoadMore,
      onAppend: append,
    })
    : null;

  return el('section', {}, [header, starredWrap, recentBlock, search, ul, more]);
}

function renderFavorites(starred, onOpen, toggleStar) {
  const rows = starred.map((c) => el('li', {
    onClick: (e) => { e.preventDefault(); onOpen(c); },
  }, [
    starToggle(true, () => toggleStar(c)),
    el('a', { href: `#/c/${c.pubkey}/${c.identifier}` }, c.name),
  ]));
  return el('div', { class: 'starred-communities' }, [
    el('h2', { class: 'recent-title' }, t('community.starred.title')),
    el('ul', { class: 'recent-list' }, rows),
  ]);
}

function renderRecent(recent, onOpen) {
  const links = recent.map((c) =>
    el('li', {
      onClick: (e) => { e.preventDefault(); onOpen(c); },
    }, el('a', { href: `#/c/${c.pubkey}/${c.identifier}` }, c.name)),
  );
  return el('div', { class: 'recent-communities' }, [
    el('h2', { class: 'recent-title' }, t('community.recent.title')),
    el('ul', { class: 'recent-list' }, links),
  ]);
}

const MAX_NAME_LEN = 16;

/** Truncate a display name the same way a pubkey fallback is shortened. */
function truncateName(name) {
  return name.length > MAX_NAME_LEN ? `${name.slice(0, MAX_NAME_LEN)}…` : name;
}

function daysSince(createdAt) {
  return Math.max(0, Math.floor((nowSeconds() - createdAt) / 86400));
}

function communityRow(c, onOpen, starred, toggleStar) {
  return el('li', {
    class: 'community-row',
    onClick: (e) => { e.preventDefault(); onOpen(c); },
  }, [
    toggleStar ? starToggle(starred, () => toggleStar(c)) : null,
    el('a', {
      class: 'community-name',
      href: `#/c/${c.pubkey}/${c.identifier}`,
    }, c.name),
    c.deleted ? el('span', { class: 'deleted-tag' }, t('community.deleted_label')) : null,
    c.description ? el('span', { class: 'community-desc' }, c.description) : null,
    el('span', { class: 'muted meta' }, t('community.meta', {
      name: truncateName(c.moderatorName ?? ''),
      days: daysSince(c.createdAt),
    })),
  ]);
}
