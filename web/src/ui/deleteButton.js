// SPDX-License-Identifier: AGPL-3.0-or-later
// Shared delete control: confirm dialog → busy label while the deletion runs →
// restore the label on failure so the user can retry. The success path is the
// caller's (`run`): a comment removes its row, a post shows the relay count.

import { el } from '../lib/dom.js';
import { t } from '../i18n/index.js';
import { showConfirm } from './dialogs.js';

/**
 * @param labelKey   i18n key for the idle button label
 * @param confirmKey i18n key for the confirm dialog message
 * @param run        async (btn) => void - performs the deletion; may replace `btn`
 */
export function deleteButton({ labelKey, confirmKey, run }) {
  const btn = el('button', {
    class: 'linkbtn',
    onClick: async (e) => {
      e.stopPropagation(); // never trigger a parent row/body click handler
      if (!(await showConfirm(t(confirmKey)))) return;
      btn.disabled = true;
      btn.textContent = t('post.deleting');
      try {
        await run(btn);
      } catch {
        btn.textContent = t(labelKey);
        btn.disabled = false;
      }
    },
  }, t(labelKey));
  return btn;
}
