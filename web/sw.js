// Service worker: cache the app shell so libre loads offline and survives a
// host takedown. It ONLY caches libre's own static files - never another host's
// runtime code, and never relay/media traffic (CLAUDE.md §1, §9).

// Unversioned, stable cache name. Freshness is handled by the stale-while-
// revalidate fetch handler (every cached file is refreshed in the background on
// each request), so there is no need to bump a version string to ship updates.
// The activate handler deletes any cache whose name isn't this one, which also
// one-time purges older versioned caches ('libre-shell-v2', …) left by prior
// builds - after that, this name never has to change.
const CACHE = 'libre-shell';
// Only precache files that exist in BOTH layouts: the multi-file dev tree and
// the single-file dist build (where CSS, JS, vendor, and i18n are all inlined
// into index.html, so /styles, /src, /vendor and /i18n do not exist). The
// dev-only assets are cached lazily by the fetch handler on first request.
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', (e) => {
  // Add each entry independently so one missing/404 asset can't abort install
  // (addAll rejects atomically - a single 404 would leave the SW uninstalled).
  e.waitUntil(
    caches.open(CACHE).then((c) => Promise.allSettled(SHELL.map((u) => c.add(u)))),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Only serve same-origin app files from cache. Everything else (relays over
  // WebSocket, media hosts) goes straight to the network, uncached.
  if (url.origin !== self.location.origin) return;
  // Stale-while-revalidate: serve cache instantly (offline-resilient) while
  // refreshing it in the background, so app/i18n edits reach clients on the
  // next load without a manual cache-version bump.
  e.respondWith(
    caches.match(e.request).then((hit) => {
      const fresh = fetch(e.request)
        .then((res) => {
          if (res.ok) caches.open(CACHE).then((c) => c.put(e.request, res.clone()));
          return res;
        })
        .catch(() => hit);
      return hit || fresh;
    }),
  );
});
