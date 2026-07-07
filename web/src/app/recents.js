// Recently visited communities, kept client-side only (no relay list, no
// NIP-51 sync). Pure app-state: no DOM (CLAUDE.md §4).

import { loadJSON, saveJSON } from '../lib/storage.js';
import { STORAGE_KEYS } from '../lib/storageKeys.js';
import { communityRef } from './communityRef.js';

const MAX = 6;

/** Most-recently-visited communities, newest first. */
export function getRecent() {
  return loadJSON(STORAGE_KEYS.recents, []);
}

/** Record a visit: moves the community to the front, dedupes, caps at MAX. */
export function recordVisit(community) {
  const entry = communityRef(community);
  const rest = getRecent().filter((c) => c.addr !== entry.addr);
  saveJSON(STORAGE_KEYS.recents, [entry, ...rest].slice(0, MAX));
}
