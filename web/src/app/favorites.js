// Starred communities, kept client-side only (no relay list, no NIP-51 sync).
// Pure app-state: no DOM (CLAUDE.md §4).

import { loadJSON, saveJSON } from '../lib/storage.js';
import { STORAGE_KEYS } from '../lib/storageKeys.js';
import { communityRef } from './communityRef.js';

/** Starred communities, most-recently-starred first. */
export function getFavorites() {
  return loadJSON(STORAGE_KEYS.favorites, []);
}

export function isFavorite(community) {
  const addr = communityRef(community).addr;
  return getFavorites().some((c) => c.addr === addr);
}

/** Toggle star state for a community. Returns the new state (true = starred). */
export function toggleFavorite(community) {
  const entry = communityRef(community);
  const list = getFavorites();
  const i = list.findIndex((c) => c.addr === entry.addr);
  if (i >= 0) {
    list.splice(i, 1);
    saveJSON(STORAGE_KEYS.favorites, list);
    return false;
  }
  saveJSON(STORAGE_KEYS.favorites, [entry, ...list]);
  return true;
}
