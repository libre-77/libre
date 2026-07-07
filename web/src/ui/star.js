// SPDX-License-Identifier: AGPL-3.0-or-later
// Star (favorite) toggle button, shared by the community list rows and the
// board header. Self-syncing: `onToggle` persists the change and returns the
// new starred state, so the glyph updates without a full view re-render.

import { el } from '../lib/dom.js';
import { t } from '../i18n/index.js';

export function starToggle(starred, onToggle) {
  let on = starred;
  const btn = el('button', { class: 'star-toggle' });
  const sync = () => {
    btn.textContent = on ? '★' : '☆';
    btn.setAttribute('aria-label', t(on ? 'community.unstar' : 'community.star'));
  };
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation(); // rows open the community on click; the star must not
    on = onToggle();
    sync();
  });
  sync();
  return btn;
}
