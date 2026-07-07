// Community board view: header, composer (if logged in), post list.
// The list shows compact rows (title + author); clicking a row opens the post
// detail view. Renders router-supplied data; no relays/protocol (CLAUDE.md §4).

import { el, mount } from '../../lib/dom.js';
import { t } from '../../i18n/index.js';
import { isLoggedIn } from '../../app/session.js';
import { loadMore } from '../loadmore.js';
import { authHint } from '../authHint.js';
import { starToggle } from '../star.js';
import { confirmNoPrivateKey } from '../guard.js';
import { renderPostRow } from './postrow.js';

export function renderCommunity(community, posts, { onPost, onUpload, onOpenPost, onBack, page, onLoadMore, favorite, onToggleFavorite }) {
  const creator = community.pubkey;
  const back = onBack
    ? el('a', { class: 'linkbtn', href: '#', onClick: (e) => { e.preventDefault(); onBack(); } }, t('post.back'))
    : null;
  const title = onToggleFavorite
    ? el('div', { class: 'community-title' }, [el('h1', {}, community.name), starToggle(favorite, onToggleFavorite)])
    : el('h1', {}, community.name);
  const header = el('div', { class: 'view-head' }, [
    back,
    title,
    community.description ? el('p', { class: 'muted' }, community.description) : null,
  ]);
  // The definition event is gone, but the board lives on through its posts.
  const banner = community.deleted ? el('p', { class: 'deleted-banner' }, t('community.deleted_banner')) : null;

  // Local copy of the list: a new post is inserted the moment it is signed
  // (pending), then confirmed or rolled back when the relay fan-out settles.
  const items = [...posts];
  const seen = new Set(posts.map((p) => p.id)); // dedup optimistic + paged rows
  const list = el('div', {});
  // Sort applies to the loaded set only (paging is time-windowed). 'new' keeps
  // the relay's newest-first order; 'top' ranks by net score (up − down), newest
  // breaking ties.
  let sort = 'new';
  const net = (p) => (p.reactions?.up ?? 0) - (p.reactions?.down ?? 0);
  const ordered = () => (sort === 'top'
    ? [...items].sort((a, b) => net(b) - net(a) || b.createdAt - a.createdAt)
    : items);
  const renderList = () => mount(list, items.length
    ? el('ul', { class: 'post-list' }, ordered().map((p) => renderPostRow(p, onOpenPost, creator)))
    : el('p', { class: 'muted' }, t('post.empty')));
  renderList();
  const sortBar = posts.length ? sortSelect((val) => { sort = val; renderList(); }) : null;

  // Older posts page in below the newest ones (list is newest-first).
  const more = page && onLoadMore
    ? loadMore({
      page, seen, fetchPage: onLoadMore,
      onAppend: (older) => { items.push(...older); renderList(); },
    })
    : null;

  const onPosted = (post) => { seen.add(post.id); items.unshift({ ...post, pending: true }); renderList(); };
  const onSettled = (post, ok) => {
    const i = items.findIndex((p) => p.id === post.id);
    if (i < 0) return;
    if (ok) items[i] = { ...items[i], pending: false };
    else items.splice(i, 1); // no relay stored it - roll the row back
    renderList();
  };

  const composer = isLoggedIn() ? renderComposer(onPost, onUpload, { onPosted, onSettled }) : authHint();

  return el('section', {}, [header, banner, composer, sortBar, list, more]);
}

// Native select to reorder the loaded post list. Plain, no framework.
function sortSelect(onChange) {
  const sel = el('select', { class: 'sort-select' }, [
    el('option', { value: 'new' }, t('sort.newest')),
    el('option', { value: 'top' }, t('sort.top')),
  ]);
  sel.addEventListener('change', () => onChange(sel.value));
  return el('label', { class: 'sort-bar muted' }, [t('sort.label'), sel]);
}

function renderComposer(onPost, onUpload, { onPosted, onSettled }) {
  const titleInput = el('input', { class: 'composer-title', type: 'text', placeholder: t('post.title_placeholder') });
  const textarea = el('textarea', { class: 'composer', rows: '3', placeholder: t('post.new_placeholder') });
  const status = el('span', { class: 'muted status' });
  // Uploaded image URLs are held here, out of the textarea, so the writing
  // surface stays clean. They are appended to the content only at publish time
  // (the wire format still carries the URL in content, where the post view
  // extracts and renders it below the text).
  const attached = [];
  const attachList = el('div', { class: 'composer-attachments' });
  const renderAttachments = () => mount(attachList,
    attached.map((url, i) => attachmentRow(i + 1, () => { attached.splice(i, 1); renderAttachments(); })));

  const submit = el('button', {
    class: 'action',
    onClick: async () => {
      const title = titleInput.value.trim();
      const text = textarea.value.trim();
      if (!title) { status.textContent = t('post.title_required'); return; }
      if (!text && !attached.length) return;
      if (!(await confirmNoPrivateKey(title, text))) return;
      const content = [text, ...attached].filter(Boolean).join('\n\n');
      submit.disabled = true;
      try {
        // Resolves at sign time; `accepted` settles when the fan-out finishes.
        const { post, accepted } = await onPost(content, title);
        titleInput.value = '';
        textarea.value = '';
        attached.length = 0;
        renderAttachments();
        status.textContent = t('post.publishing');
        onPosted(post);
        accepted.then((count) => {
          status.textContent = count > 0 ? t('post.accepted', { count }) : t('error.publish_failed');
          onSettled(post, count > 0);
        });
      } catch (err) {
        console.error('post publish failed', err);
        status.textContent = t('error.publish_failed');
      } finally {
        submit.disabled = false;
      }
    },
  }, t('post.submit'));

  const attach = imageAttach(onUpload, status, (url) => { attached.push(url); renderAttachments(); });

  return el('form', { class: 'composer-box', onSubmit: (e) => e.preventDefault() }, [
    titleInput,
    textarea,
    attachList,
    el('div', { class: 'composer-actions' }, [status, attach, submit]),
  ]);
}

// One attached-image line: a plain label plus a remove link. No thumbnail:
// encrypted images can't be previewed without decrypting, so all attachments
// read the same, HN-plain way.
function attachmentRow(n, onRemove) {
  return el('div', { class: 'attach-item muted' }, [
    el('span', {}, t('post.image_attached', { n })),
    el('button', { class: 'linkbtn', type: 'button', onClick: onRemove }, t('post.attach_remove')),
  ]);
}

// File input that uploads an image (Blossom); the resulting URL is handed to
// `onAdded` rather than dumped into the textarea.
function imageAttach(onUpload, status, onAdded) {
  const input = el('input', { type: 'file', accept: 'image/*', class: 'file-input' });
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    status.textContent = t('post.uploading');
    try {
      onAdded(await onUpload(file));
      status.textContent = '';
    } catch {
      status.textContent = t('error.upload_failed');
    } finally {
      input.value = '';
    }
  });
  return el('label', { class: 'attach' }, [t('post.attach_image'), input]);
}
