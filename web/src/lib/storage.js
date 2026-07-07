// Tiny safe localStorage helpers. Pure edge-effect module, no app logic.

/** Read and JSON-parse a key; return fallback on miss or corruption. */
export function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/** JSON-stringify and store; null removes the key. Never throws. */
export function saveJSON(key, value) {
  try {
    if (value === null || value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or unavailable (private mode) - non-fatal
  }
}
