// Relay-connection consent gate. Before any read/write touches a relay, the
// user must acknowledge that relays are third-party servers which can see the
// connecting IP address (an opsec/deanonymization surface, CLAUDE.md §1, §5).
// No DOM, no protocol here - just the persisted decision.

import { loadJSON, saveJSON } from '../lib/storage.js';
import { STORAGE_KEYS } from '../lib/storageKeys.js';

/** Has the user acknowledged the relay/IP exposure warning on this device? */
export function hasRelayConsent() {
  return loadJSON(STORAGE_KEYS.relayConsent, false) === true;
}

/** Record that the user accepted the warning. Persisted per device. */
export function grantRelayConsent() {
  saveJSON(STORAGE_KEYS.relayConsent, true);
}
