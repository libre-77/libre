// Reusable "load more" button for cursor-paginated lists. Renders data only;
// the actual fetch is a router-supplied callback (CLAUDE.md §4). Keeps the UI
// off the network and lets every long list page backwards on demand instead of
// pulling the whole history at once.

import { el } from '../lib/dom.js';
import { t } from '../i18n/index.js';

/**
 * @param page       current cursor: { hasMore, nextUntil }
 * @param seen       Set of keys already rendered (deduped across pages)
 * @param fetchPage  (until) => Promise<{ items, hasMore, nextUntil }>
 * @param onAppend   (freshItems) => void: insert the new, deduped items
 * @param keyOf      item -> dedup key (default: event id)
 * @param label      idle button text (default: t('list.load_more'))
 */
export function loadMore({ page, seen, fetchPage, onAppend, keyOf = (it) => it.id, label }) {
  const idle = label ?? t('list.load_more');
  const btn = el('button', { class: 'action load-more' }, idle);
  let cursor = page.nextUntil;
  let more = page.hasMore;
  const sync = () => { btn.hidden = !more; };
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = t('list.loading_more');
    try {
      const next = await fetchPage(cursor);
      const fresh = next.items.filter((it) => !seen.has(keyOf(it)));
      fresh.forEach((it) => seen.add(keyOf(it)));
      cursor = next.nextUntil;
      // No fresh items despite a full page means we only got boundary duplicates:
      // there is nothing new to page to, so stop rather than loop the same page.
      more = next.hasMore && fresh.length > 0;
      btn.textContent = idle;
      if (fresh.length) onAppend(fresh);
    } catch {
      btn.textContent = t('list.load_failed');
    } finally {
      btn.disabled = false;
      sync();
    }
  });
  sync();
  return btn;
}
