// Boot + wiring. Thin entry point: load locale, restore session, build the
// page shell, start the router. All logic lives in the layers (CLAUDE.md §7).

import { detectLocale, loadLocale, setLocale } from './i18n/index.js';
import { init as initSession, subscribe as subscribeSession } from './app/session.js';
import { start as startRouter, rerender } from './app/router.js';
import { renderHeader, renderFooter } from './ui/chrome.js';
import { el } from './lib/dom.js';

let view = null;

async function boot() {
  await loadLocale(detectLocale());
  await initSession();

  view = el('main', { id: 'view', class: 'container' });
  renderShell();

  // Rebuild the shell on consent so footer chrome (e.g. the source link, hidden
  // until now) appears without a reload.
  startRouter(view, renderShell);
  // Re-render the current view when auth state changes (login/logout/unlock)
  // so login-gated pages reflect the new session without a manual refresh.
  subscribeSession(() => rerender());
  registerServiceWorker();
}

/** (Re)build the page shell around the persistent view node. */
function renderShell() {
  const app = document.getElementById('app');
  app.replaceChildren(
    renderHeader({ onLocale: changeLocale }),
    view,
    renderFooter(),
  );
}

// Re-render in place instead of reloading: a full reload would wipe the
// in-memory unlocked key and force the user to re-enter their passphrase.
async function changeLocale(locale) {
  setLocale(locale);
  await loadLocale(locale);
  renderShell();
  await rerender();
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  // On a dev host the offline shell only gets in the way: its stale-while-
  // revalidate cache makes every edit take two reloads to show. Skip it, and
  // tear down any worker + caches a previous run left behind so reloads are live.
  if (isDevHost()) {
    navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
    if (self.caches) caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
    return;
  }
  navigator.serviceWorker.register('/sw.js').catch(() => {
    // offline shell is an enhancement; app works without it
  });
}

// Local development origins where the offline cache should stay off.
function isDevHost() {
  const h = location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '' || h.endsWith('.local');
}

boot();
