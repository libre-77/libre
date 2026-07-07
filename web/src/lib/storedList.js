// SPDX-License-Identifier: AGPL-3.0-or-later
// A user-editable list setting persisted in localStorage (relay list, media
// server list). The user's value wins when set; empty/invalid input restores
// the defaults. Pure storage logic - callers supply the validation pattern.

import { loadJSON, saveJSON } from './storage.js';

/**
 * @param key      localStorage key
 * @param defaults list returned while no valid user value is stored
 * @param pattern  RegExp an entry must match to be kept
 * @returns {{ get: () => string[], set: (values: string[]) => string[] }}
 */
export function storedList({ key, defaults, pattern }) {
  const get = () => {
    const saved = loadJSON(key, null);
    return Array.isArray(saved) && saved.length ? saved : defaults;
  };
  const set = (values) => {
    const seen = new Set();
    const clean = [];
    for (const raw of values) {
      const value = String(raw).trim();
      if (!pattern.test(value) || seen.has(value)) continue;
      seen.add(value);
      clean.push(value);
    }
    saveJSON(key, clean.length ? clean : null);
    return clean.length ? clean : defaults;
  };
  return { get, set };
}
