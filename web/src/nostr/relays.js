// User-editable relay list with censorship-resistant defaults.
// Defaults are spread across jurisdictions and deliberately exclude the
// target-censorship jurisdiction (CLAUDE.md §1, §5). Users can edit freely;
// their choice is persisted locally and always wins over defaults.

import { storedList } from '../lib/storedList.js';
import { STORAGE_KEYS } from '../lib/storageKeys.js';

// Multiple independent operators, none KR-based. Reads tolerate any subset down.
// These accept open writes incl. NIP-72 community events (kind 34550). Avoid
// relays that block moderated communities (e.g. relay.damus.io) or require paid
// signup (e.g. nostr.wine) - they reject writes and add console noise. Also
// avoid relays that cap concurrent subscriptions per connection (e.g.
// nostr-pub.wellorder.net EOSEs only the first REQ and silently drops the
// rest, which stalls every pooled query to the full timeout).
export const DEFAULT_RELAYS = [
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://nostr.mom',
  'wss://nostr.oxtr.dev',
];

const relayList = storedList({
  key: STORAGE_KEYS.relays,
  defaults: DEFAULT_RELAYS,
  pattern: /^wss?:\/\/.+/, // relays speak WebSocket only
});

/** Return the active relay list (user override, else defaults). */
export const getRelays = relayList.get;

/** Persist a user-edited relay list. Empty/invalid input restores defaults. */
export const setRelays = relayList.set;
