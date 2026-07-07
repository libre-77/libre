// SPDX-License-Identifier: AGPL-3.0-or-later
// Promise-based replacements for window.alert/confirm/prompt. Native dialogs
// are unreliable on mobile: many in-app WebView browsers (KakaoTalk, Instagram,
// Naver) never implement onJsPrompt/onJsConfirm, so the call silently returns
// null/undefined with no UI shown at all - a flow just aborts with no visible
// cause. These render as ordinary DOM modals instead, which always work.

import { el } from '../lib/dom.js';
import { t } from '../i18n/index.js';

/** Build and mount an empty modal (overlay + panel). Returns the overlay node. */
export function openModal(children) {
  const overlay = el('div', { class: 'modal-overlay' });
  const panel = el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' }, children);
  overlay.append(panel);
  document.body.append(overlay);
  return overlay;
}

/** Replacement for window.alert(). Resolves once dismissed. */
export function showAlert(message) {
  return new Promise((resolve) => {
    const overlay = openModal([]);
    const close = () => { overlay.remove(); resolve(); };
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    const okBtn = el('button', { class: 'action', onClick: close }, t('dialog.ok'));
    overlay.firstChild.append(el('p', {}, message), el('div', { class: 'modal-actions' }, [okBtn]));
    okBtn.focus();
  });
}

/** Replacement for window.confirm(). Resolves true/false. */
export function showConfirm(message) {
  return new Promise((resolve) => {
    const overlay = openModal([]);
    const finish = (value) => { overlay.remove(); resolve(value); };
    overlay.addEventListener('click', (e) => { if (e.target === overlay) finish(false); });
    const okBtn = el('button', { class: 'action', onClick: () => finish(true) }, t('dialog.ok'));
    const cancelBtn = el('button', { class: 'linkbtn', onClick: () => finish(false) }, t('dialog.cancel'));
    overlay.firstChild.append(el('p', {}, message), el('div', { class: 'modal-actions' }, [cancelBtn, okBtn]));
    okBtn.focus();
  });
}

/**
 * Replacement for window.prompt(). Resolves the entered value, or null if
 * cancelled/dismissed - same contract as window.prompt(). `masked` renders a
 * password-type input (native prompt() can never mask, so this is strictly better).
 */
export function showPromptDialog(message, { masked = false } = {}) {
  return new Promise((resolve) => {
    const overlay = openModal([]);
    const input = el('input', { class: 'keyfield', type: masked ? 'password' : 'text' });
    const finish = (value) => { overlay.remove(); resolve(value); };
    const submit = () => finish(input.value || null);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) finish(null); });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    const okBtn = el('button', { class: 'action', onClick: submit }, t('dialog.ok'));
    const cancelBtn = el('button', { class: 'linkbtn', onClick: () => finish(null) }, t('dialog.cancel'));
    overlay.firstChild.append(el('p', {}, message), input, el('div', { class: 'modal-actions' }, [cancelBtn, okBtn]));
    input.focus();
  });
}
