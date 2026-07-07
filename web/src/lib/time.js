// Locale-aware relative time. Uses the Intl API (no hardcoded formats, CLAUDE.md §6).

/** Current unix time in seconds (the resolution Nostr events use). */
export function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

/**
 * Format a unix-seconds timestamp as relative time in the given locale,
 * e.g. "3 hours ago" / "3시간 전".
 */
export function timeAgo(unixSeconds, locale) {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const deltaSec = unixSeconds - nowSeconds();
  const units = [
    ['year', 31536000],
    ['month', 2592000],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  for (const [unit, secs] of units) {
    if (Math.abs(deltaSec) >= secs) return rtf.format(Math.round(deltaSec / secs), unit);
  }
  return rtf.format(Math.round(deltaSec), 'second');
}
