// Minimal i18n. Detects locale, loads flat dotted-key JSON, exposes t(key, params).
// No hardcoded user-facing strings live outside the JSON files (CLAUDE.md §6).
// Dependency-free, well under the size ceiling.

import { loadJSON, saveJSON } from '../lib/storage.js';
import { STORAGE_KEYS } from '../lib/storageKeys.js';

export const SUPPORTED = ['en', 'ko'];
const FALLBACK = 'en';

let strings = {}; // active locale table
let fallbackStrings = {}; // en table, for missing keys
let current = FALLBACK;

/** Pick a locale: user override → navigator language → fallback. */
export function detectLocale() {
  const override = loadJSON(STORAGE_KEYS.locale, null);
  if (override && SUPPORTED.includes(override)) return override;
  const nav = (navigator.language || FALLBACK).slice(0, 2);
  return SUPPORTED.includes(nav) ? nav : FALLBACK;
}

/** Load a locale (and the fallback table) and apply document direction. */
export async function loadLocale(locale) {
  current = SUPPORTED.includes(locale) ? locale : FALLBACK;
  fallbackStrings = await fetchTable(FALLBACK);
  strings = current === FALLBACK ? fallbackStrings : await fetchTable(current);
  document.documentElement.lang = current;
  document.documentElement.dir = isRTL(current) ? 'rtl' : 'ltr';
  return current;
}

/** Persist a user's explicit locale choice. */
export function setLocale(locale) {
  saveJSON(STORAGE_KEYS.locale, SUPPORTED.includes(locale) ? locale : null);
}

export function getLocale() {
  return current;
}

/** Translate `key`, interpolating {name} params. Falls back en → key. */
export function t(key, params) {
  let s = strings[key] ?? fallbackStrings[key] ?? key;
  if (params) s = s.replace(/\{(\w+)\}/g, (_, p) => (p in params ? params[p] : `{${p}}`));
  return s;
}

async function fetchTable(locale) {
  // Single-file build inlines all locale tables as a read-only constant so the
  // app works with zero runtime fetches (even from file://). Multi-file dev
  // serving falls back to fetching the JSON files.
  const inlined = globalThis.__LIBRE_I18N;
  if (inlined && inlined[locale]) return inlined[locale];
  const res = await fetch(`/i18n/${locale}.json`);
  if (!res.ok) throw new Error(`i18n load failed: ${locale}`);
  return res.json();
}

function isRTL(locale) {
  return ['ar', 'he', 'fa', 'ur'].includes(locale);
}
