// SPDX-License-Identifier: AGPL-3.0-or-later
// Identity key flows: create/import/unlock/backup a local identity, plus the
// nsec backup modal. Split out of chrome.js (200-line ceiling, CLAUDE.md §4).
// Key derivation (PBKDF2 210k) takes a noticeable moment, so every flow shows
// a busy label on its trigger button while the crypto runs.

import { el } from '../lib/dom.js';
import { t } from '../i18n/index.js';
import * as session from '../app/session.js';
import { showAlert, showConfirm, showPromptDialog, openModal } from './dialogs.js';

// Show a busy label on `btn` while `work` runs. The label is restored on
// failure; on success the login area re-renders itself anyway.
async function withBusy(btn, work) {
  const previous = btn.textContent;
  btn.disabled = true;
  btn.textContent = t('login.working');
  try {
    return await work();
  } finally {
    btn.disabled = false;
    btn.textContent = previous;
  }
}

// Create a passphrase-protected local identity. Passphrase encrypts the key at
// rest and cannot be recovered - surfaced clearly before we generate anything.
export async function createLocalFlow(btn) {
  if (!(await showConfirm(t('login.security_warning')))) return;
  const pass = await showPromptDialog(t('login.set_passphrase'), { masked: true });
  if (!pass) return;
  const confirmPass = await showPromptDialog(t('login.confirm_passphrase'), { masked: true });
  if (pass !== confirmPass) {
    await showAlert(t('login.passphrase_mismatch'));
    return;
  }
  await withBusy(btn, () => session.createLocal(pass));
  showKeyModal(session.currentNsec()); // the nsec is the only recovery value
}

// Reveal the current local identity's nsec again, for a user who wants to back
// it up after the fact or copy it to another device. Re-prompt for the passphrase
// so a walk-up on an already-unlocked session can't lift the key.
export async function backupKeyFlow(btn) {
  if (!session.currentNsec()) return; // extension / locked: nothing to export
  const pass = await showPromptDialog(t('login.backup_prompt'), { masked: true });
  if (!pass) return;
  try {
    const nsec = await withBusy(btn, () => session.exportNsecWithPassphrase(pass));
    showKeyModal(nsec);
  } catch {
    await showAlert(t('error.bad_passphrase'));
  }
}

// Import an existing account by pasting its nsec. Same passphrase-encryption
// path as create - the nsec is validated, then only its ciphertext hits disk.
export async function importLocalFlow(btn) {
  if (!(await showConfirm(t('login.import_warning')))) return;
  const nsec = await showPromptDialog(t('login.import_prompt'), { masked: true });
  if (!nsec) return;
  let npub;
  try {
    npub = session.npubFromNsec(nsec); // decode only - nothing stored yet
  } catch {
    await showAlert(t('error.bad_nsec'));
    return;
  }
  if (!(await showConfirm(t('login.import_confirm', { npub })))) return;
  const pass = await showPromptDialog(t('login.set_passphrase'), { masked: true });
  if (!pass) return;
  const confirmPass = await showPromptDialog(t('login.confirm_passphrase'), { masked: true });
  if (pass !== confirmPass) {
    await showAlert(t('login.passphrase_mismatch'));
    return;
  }
  try {
    await withBusy(btn, () => session.importLocal(nsec, pass));
  } catch {
    await showAlert(t('error.bad_nsec'));
  }
}

export async function unlockFlow(btn) {
  const pass = await showPromptDialog(t('login.unlock_prompt'), { masked: true });
  if (!pass) return;
  try {
    await withBusy(btn, () => session.unlock(pass));
  } catch {
    await showAlert(t('error.bad_passphrase'));
  }
}

// Backup surface for the secret key (nsec). Uses a readonly input (selectable,
// unlike alert() text) plus an explicit copy button - the nsec is the only way
// to recover the account or log in elsewhere, so it must be copyable on desktop
// and mobile alike.
function showKeyModal(nsec) {
  const field = el('input', { class: 'keyfield', type: 'text', value: nsec, readonly: 'readonly' });
  const copyBtn = el('button', { class: 'action' }, t('login.copy'));
  copyBtn.addEventListener('click', () => copyText(nsec, copyBtn));
  const closeBtn = el('button', { class: 'linkbtn' }, t('login.close'));
  const overlay = openModal([
    el('p', {}, t('login.nsec_warning')),
    el('label', { class: 'muted' }, t('login.your_nsec')),
    field,
    el('div', { class: 'modal-actions' }, [copyBtn, closeBtn]),
  ]);
  closeBtn.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  field.focus();
  field.select();
}

// Copy `text` to the clipboard, falling back to a manual selection when the
// async Clipboard API is unavailable (insecure origin, older browser).
export async function copyText(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const tmp = el('input', { type: 'text', value: text });
    document.body.append(tmp);
    tmp.select();
    document.execCommand('copy');
    tmp.remove();
  }
  const prev = btn.textContent;
  btn.replaceChildren(
    el('span', { class: 'copy-check', 'aria-hidden': 'true' }, '✓'),
    document.createTextNode(t('login.copied')),
  );
  setTimeout(() => { btn.textContent = prev; }, 1500);
}
