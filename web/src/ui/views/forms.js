// Two small form views: create-community and relay settings.

import { el } from '../../lib/dom.js';
import { t } from '../../i18n/index.js';
import { getRelays, setRelays, DEFAULT_RELAYS } from '../../nostr/relays.js';
import { getMediaServers, setMediaServers } from '../../nostr/media.js';
import { isLoggedIn } from '../../app/session.js';
import { authHint } from '../authHint.js';
import { confirmNoPrivateKey } from '../guard.js';
import { field } from './field.js';

export function renderNewCommunity({ onCreate }) {
  if (!isLoggedIn()) {
    return el('section', { class: 'prose' }, [el('h1', {}, t('community.create.title')), authHint()]);
  }

  const id = field('community.create.id', 'community.create.id_hint');
  const name = field('community.create.name', 'community.create.name_hint');
  const desc = field('community.create.description', 'community.create.description_hint');
  const status = el('span', { class: 'muted status' });

  const submit = el('button', {
    class: 'action',
    onClick: async () => {
      const identifier = id.input.value.trim().replace(/\s+/g, '-');
      const nameVal = name.input.value.trim();
      const descVal = desc.input.value.trim();
      if (!identifier || !nameVal) {
        status.textContent = t('error.required');
        return;
      }
      if (!(await confirmNoPrivateKey(identifier, nameVal, descVal))) return;
      submit.disabled = true;
      status.textContent = t('community.create.creating');
      try {
        await onCreate({ identifier, name: nameVal, description: descVal });
      } catch {
        status.textContent = t('error.publish_failed');
        submit.disabled = false;
      }
    },
  }, t('community.create.submit'));

  return el('section', { class: 'prose' }, [
    el('h1', {}, t('community.create.title')),
    el('p', { class: 'muted' }, t('community.create.intro')),
    el('p', { class: 'notice' }, t('community.create.permanent_note')),
    el('form', { class: 'stack', onSubmit: (e) => e.preventDefault() }, [
      id.row, name.row, desc.row, el('div', { class: 'form-actions' }, [status, submit]),
    ]),
  ]);
}

export function renderRelays() {
  const textarea = el('textarea', { class: 'relay-box', rows: '6' });
  textarea.value = getRelays().join('\n');
  const status = el('span', { class: 'muted status' });

  // A one-relay list quietly forfeits all censorship resistance: that relay
  // becomes a single point of failure, censorship and surveillance. Warn.
  const warning = el('p', { class: 'notice' }, t('relays.single_warning'));
  const refreshWarning = () => { warning.hidden = getRelays().length !== 1; };
  refreshWarning();

  const save = el('button', {
    class: 'action',
    onClick: () => {
      setRelays(textarea.value.split('\n'));
      textarea.value = getRelays().join('\n');
      status.textContent = t('relays.saved');
      refreshWarning();
    },
  }, t('relays.save'));

  const reset = el('button', {
    class: 'action secondary',
    onClick: () => {
      setRelays([]);
      textarea.value = DEFAULT_RELAYS.join('\n');
      status.textContent = t('relays.saved');
      refreshWarning();
    },
  }, t('relays.reset'));

  return el('section', { class: 'prose' }, [
    el('h1', {}, t('relays.title')),
    el('p', { class: 'muted' }, t('relays.description')),
    warning,
    textarea,
    el('div', { class: 'form-actions' }, [status, save, reset]),
    mediaServersBlock(),
  ]);
}

function mediaServersBlock() {
  const textarea = el('textarea', { class: 'relay-box', rows: '3' });
  textarea.value = getMediaServers().join('\n');
  const status = el('span', { class: 'muted status' });
  const save = el('button', {
    class: 'action',
    onClick: () => {
      setMediaServers(textarea.value.split('\n'));
      textarea.value = getMediaServers().join('\n');
      status.textContent = t('relays.saved');
    },
  }, t('relays.save'));

  return el('div', { class: 'prose' }, [
    el('h1', {}, t('media.title')),
    el('p', { class: 'muted' }, t('media.description')),
    textarea,
    el('div', { class: 'form-actions' }, [status, save]),
  ]);
}
