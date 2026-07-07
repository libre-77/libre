// Profile editor: set the display name (and short bio) other users see instead
// of the raw npub. Publishes kind-0 metadata. Renders data + emits intents; no
// protocol or relays here (CLAUDE.md §4).

import { el } from '../../lib/dom.js';
import { t } from '../../i18n/index.js';
import { isLoggedIn } from '../../app/session.js';
import { authHint } from '../authHint.js';
import { confirmNoPrivateKey } from '../guard.js';
import { field } from './field.js';

export function renderProfile(profile, { onSave }) {
  if (!isLoggedIn()) {
    return el('section', { class: 'prose' }, [
      el('h1', {}, t('profile.title')),
      authHint(),
    ]);
  }

  const name = field('profile.name_label', 'profile.name_hint', { value: profile.name || '' });
  const about = field('profile.about_label', null, { tag: 'textarea', value: profile.about || '' });
  const status = el('span', { class: 'muted status' });

  const save = el('button', {
    class: 'action',
    onClick: async () => {
      const nameVal = name.input.value.trim();
      const aboutVal = about.input.value.trim();
      if (!(await confirmNoPrivateKey(nameVal, aboutVal))) return;
      save.disabled = true;
      status.textContent = t('profile.saving');
      try {
        // Preserve any other fields (picture, nip05, …) the account already has.
        const meta = { ...profile, name: nameVal, about: aboutVal };
        const accepted = await onSave(meta);
        status.textContent = accepted > 0 ? t('profile.saved', { count: accepted }) : t('error.publish_failed');
      } catch {
        status.textContent = t('error.publish_failed');
      } finally {
        save.disabled = false;
      }
    },
  }, t('profile.save'));

  return el('section', { class: 'prose' }, [
    el('h1', {}, t('profile.title')),
    el('p', { class: 'muted' }, t('profile.intro')),
    el('form', { class: 'stack', onSubmit: (e) => e.preventDefault() }, [
      name.row, about.row, el('div', { class: 'form-actions' }, [status, save]),
    ]),
  ]);
}
