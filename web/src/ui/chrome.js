// Persistent page chrome: header (brand, nav, login, locale) and footer.
// The login area subscribes to session changes and re-renders itself in place.

import { el, mount } from '../lib/dom.js';
import { t, SUPPORTED, getLocale } from '../i18n/index.js';
import * as session from '../app/session.js';
import { hasRelayConsent } from '../app/consent.js';
import { createLocalFlow, importLocalFlow, unlockFlow, backupKeyFlow, copyText } from './keyflows.js';
import { showConfirm } from './dialogs.js';
import { dot } from './byline.js';

const SOURCE_URL = 'https://github.com/libre-77/libre';

export function renderHeader({ onLocale }) {
  const nav = el('nav', { class: 'nav' }, [
    navLink('#/', 'nav.home'),
    navLink('#/profile', 'nav.profile'),
    navLink('#/relays', 'nav.relays'),
    navLink('#/settings', 'nav.settings'),
    navLink('#/about', 'nav.about'),
  ]);

  const loginArea = el('span', { class: 'login-area' });
  const renderLogin = () => mount(loginArea, loginWidget());
  session.subscribe(renderLogin);
  renderLogin();

  return el('header', { class: 'site-head' }, [
    el('a', { class: 'brand', href: '#/' }, t('app.name')),
    nav,
    el('span', { class: 'spacer' }),
    localeSelect(onLocale),
    loginArea,
  ]);
}

export function renderFooter() {
  const items = [];
  // Before consent, the footer carries no link to a third-party host (the source
  // repo): while the relay gate is up, nothing off-device is even offered.
  if (hasRelayConsent()) {
    items.push(el('a', { href: SOURCE_URL }, t('footer.source')), dot());
  }
  items.push(
    el('span', {}, t('footer.license')),
    dot(),
    el('span', {}, t('app.tagline')),
  );
  return el('footer', { class: 'site-foot muted' }, items);
}

function loginWidget() {
  if (session.isLoggedIn()) {
    const npub = session.currentNpub();
    const who = el('button', { class: 'linkbtn muted', title: t('login.copy_key') },
      t('login.logged_in_as', { name: shorten(npub) }));
    who.addEventListener('click', () => copyText(npub, who));
    const kids = [who];
    // Only a local (unlocked) key can be exported; an extension holds its own.
    if (session.currentNsec()) {
      kids.push(el('button', { class: 'linkbtn', onClick: (e) => backupKeyFlow(e.currentTarget) }, t('login.backup_key')));
    }
    kids.push(el('button', { class: 'linkbtn', onClick: () => logoutFlow() }, t('login.logout')));
    return el('span', { class: 'login-buttons' }, kids);
  }
  if (session.isLocked()) {
    return el('span', { class: 'login-buttons' }, [
      el('button', { class: 'action', onClick: (e) => unlockFlow(e.currentTarget) }, t('login.unlock')),
    ]);
  }
  const children = [];
  if (session.hasExtension()) {
    children.push(el('button', { class: 'action', onClick: () => session.loginExtension() }, t('login.extension')));
  }
  children.push(el('button', { class: 'linkbtn', onClick: (e) => createLocalFlow(e.currentTarget) }, t('login.create_local')));
  children.push(el('button', { class: 'linkbtn', onClick: (e) => importLocalFlow(e.currentTarget) }, t('login.import')));
  return el('span', { class: 'login-buttons' }, children);
}

async function logoutFlow() {
  if (await showConfirm(t('login.logout_confirm'))) session.logout();
}

const LOCALE_NAMES = { en: 'English', ko: '한국어' };

function localeSelect(onLocale) {
  const sel = el('select', { class: 'locale', onChange: (e) => onLocale(e.target.value) });
  for (const loc of SUPPORTED) {
    const opt = el('option', { value: loc }, LOCALE_NAMES[loc] ?? loc.toUpperCase());
    if (loc === getLocale()) opt.selected = true;
    sel.append(opt);
  }
  return sel;
}

function navLink(href, key) {
  return el('a', { class: 'nav-link', href }, t(key));
}

function shorten(npub) {
  return npub ? npub.slice(0, 10) + '…' : '';
}
