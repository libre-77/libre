// SPDX-License-Identifier: AGPL-3.0-or-later
// Labelled form row shared by the create-community and profile forms:
// label text, optional muted hint, then the input or textarea.

import { el } from '../../lib/dom.js';
import { t } from '../../i18n/index.js';

/** @returns {{ row: HTMLElement, input: HTMLElement }} */
export function field(labelKey, hintKey, { tag = 'input', value = '' } = {}) {
  const input = tag === 'textarea'
    ? el('textarea', { class: 'composer', rows: '3' })
    : el('input', { class: 'input', type: 'text' });
  input.value = value;
  const parts = [el('span', {}, t(labelKey))];
  if (hintKey) parts.push(el('span', { class: 'field-hint muted' }, t(hintKey)));
  parts.push(input);
  return { row: el('label', { class: 'field' }, parts), input };
}
