// About view - states why libre exists. Plain prose, no decoration (CLAUDE.md §3).

import { el } from '../../lib/dom.js';
import { t } from '../../i18n/index.js';

export function renderAbout() {
  return el('section', { class: 'prose' }, [
    el('h1', {}, t('about.title')),
    el('p', {}, t('about.body')),
    el('p', { class: 'muted' }, t('about.law_note')),
  ]);
}
