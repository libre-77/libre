// First-run relay-consent gate. A blocking screen shown before the app makes
// any relay connection, warning that relays are third-party servers which can
// observe the connecting IP. Renders data + emits the `onContinue` intent only;
// persistence and routing live in app/ (CLAUDE.md §4).

import { el } from '../../lib/dom.js';
import { t } from '../../i18n/index.js';

/** Build the consent gate. `onContinue` fires when the user accepts. */
export function renderConsentGate({ onContinue }) {
  const panel = el('div', { class: 'gate', role: 'dialog', 'aria-modal': 'true' }, [
    el('h1', {}, t('gate.title')),
    el('p', {}, t('gate.body')),
    // Spell out the exact behaviour so the user knows what "continue" does and
    // what happens before it: no relay is touched until they accept.
    el('ul', { class: 'gate-facts muted' }, [
      el('li', {}, t('gate.fact_blocked')),
      el('li', {}, t('gate.fact_ip')),
      el('li', {}, t('gate.fact_saved')),
    ]),
    el('p', { class: 'muted' }, t('gate.tip')),
    el('div', { class: 'gate-actions' }, [
      el('button', { class: 'action', onClick: onContinue }, t('gate.continue')),
    ]),
  ]);
  return el('div', { class: 'gate-wrap' }, panel);
}
