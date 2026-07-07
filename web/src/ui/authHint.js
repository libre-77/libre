// Shared "sign-in required" hint for UGC-gated views. Distinguishes a locked
// local identity (needs unlock) from no identity at all (needs login).

import { el } from '../lib/dom.js';
import { t } from '../i18n/index.js';
import { isLocked } from '../app/session.js';

export function authHint() {
  return el('p', { class: 'muted' }, t(isLocked() ? 'error.locked' : 'error.not_logged_in'));
}
