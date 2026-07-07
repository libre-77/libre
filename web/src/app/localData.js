// SPDX-License-Identifier: AGPL-3.0-or-later
// Wipes every piece of app data persisted on this device: recent/favorite
// communities, relay and media server overrides, locale, relay consent, and
// the local identity key. Relay-hosted content is untouched - this only
// clears what libre itself stored locally (CLAUDE.md §1: the user owns their
// keys, so deleting them is the same irreversible act as `logout`).

import { saveJSON } from '../lib/storage.js';
import { STORAGE_KEYS } from '../lib/storageKeys.js';
import { logout } from './session.js';

/** Permanently erase all local app data, including any encrypted local identity. */
export async function clearAllLocalData() {
  await logout();
  for (const key of Object.values(STORAGE_KEYS)) saveJSON(key, null);
}
