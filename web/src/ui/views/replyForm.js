// Reply composer for the comment thread, plus the click-to-reply toggle that
// mounts it inline under a comment. Split out of comments.js to keep each file
// within the size ceiling (CLAUDE.md §4). Renders data only; publishing goes
// through ctx.onReply and reconciles via ctx.insert.

import { el } from '../../lib/dom.js';
import { t } from '../../i18n/index.js';
import { confirmNoPrivateKey } from '../guard.js';

export function makeToggle(slot, parentId, ctx) {
  return () => {
    if (slot.firstChild) return slot.replaceChildren();
    slot.append(replyForm(
      { id: parentId },
      ctx,
      t('comment.reply_placeholder'),
      t('comment.reply_submit'),
    ));
  };
}

export function replyForm(parent, ctx, placeholder, submitLabel) {
  const textarea = el('textarea', { class: 'composer', rows: '2', placeholder });
  const status = el('span', { class: 'muted status' });
  const submit = el('button', {
    class: 'action',
    onClick: async () => {
      const content = textarea.value.trim();
      if (!content) return;
      if (!(await confirmNoPrivateKey(content))) return;
      submit.disabled = true;
      try {
        // Resolves at sign time; the insert re-renders the section (closing
        // this form) and reconciles when the fan-out settles.
        const { post: comment, accepted } = await ctx.onReply(parent, content);
        textarea.value = '';
        ctx.insert(comment, accepted);
      } catch {
        status.textContent = t('error.publish_failed');
      } finally {
        submit.disabled = false;
      }
    },
  }, submitLabel);
  return el('form', { class: 'composer-box', onSubmit: (e) => e.preventDefault() }, [
    textarea,
    el('div', { class: 'composer-actions' }, [status, submit]),
  ]);
}
