// SPDX-License-Identifier: AGPL-3.0-or-later
// UGC submit guard: before any user text leaves the device for a relay, scan it
// for an accidentally pasted `nsec…` private key and make the user confirm. The
// pure detection lives in lib; the interaction (a DOM confirm modal) lives here.

import { containsNsec } from '../lib/nsecGuard.js';
import { showConfirm } from './dialogs.js';
import { t } from '../i18n/index.js';

/**
 * Returns true when it is safe to publish the given text values. If any value
 * looks like it carries a private key, warn and let the user withdraw: OK
 * proceeds, cancel aborts. With no key present it resolves true immediately.
 */
export async function confirmNoPrivateKey(...values) {
  if (!values.some(containsNsec)) return true;
  return showConfirm(t('guard.nsec_warning'));
}
