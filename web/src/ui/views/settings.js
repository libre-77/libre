// SPDX-License-Identifier: AGPL-3.0-or-later
// Settings view - local device data management. No server-side account here,
// so "settings" means what's stored on this device (CLAUDE.md §4: no DOM
// leaks protocol logic; this view only wires the confirm + reload).

import { el } from '../../lib/dom.js';
import { t } from '../../i18n/index.js';
import { showConfirm } from '../dialogs.js';
import { clearAllLocalData } from '../../app/localData.js';

export function renderSettings() {
  const deleteBtn = el('button', {
    class: 'action',
    onClick: async () => {
      const ok = await showConfirm(t('settings.delete_data_confirm'));
      if (!ok) return;
      await clearAllLocalData();
      location.hash = '#/';
      location.reload();
    },
  }, t('settings.delete_data'));

  return el('section', { class: 'prose' }, [
    el('h1', {}, t('settings.title')),
    el('p', { class: 'muted' }, t('settings.description')),
    el('div', { class: 'form-actions' }, [deleteBtn]),
  ]);
}
