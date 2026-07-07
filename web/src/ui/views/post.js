// Single-post detail view (board style): title + author + full content, then
// the nested comment thread. Reached from the community post list. Renders
// data only; intents go back to the router via callbacks (CLAUDE.md §4).

import { el } from '../../lib/dom.js';
import { t } from '../../i18n/index.js';
import { extractImageUrls, isEncryptedImageUrl } from '../../lib/images.js';
import { linkifySegments } from '../../lib/linkify.js';
import { renderComments } from './comments.js';
import { reactionBar } from '../reactions.js';
import { showConfirm } from '../dialogs.js';
import { bylineBits, dot } from '../byline.js';
import { deleteButton } from '../deleteButton.js';

export function renderPostDetail(post, comments, { me, creator, deleted, onDelete, onReply, onReact, onUnreact, onLoadImage, onBack, page, onLoadMore }) {
  const back = el('a', { class: 'linkbtn', href: '#', onClick: (e) => { e.preventDefault(); onBack(); } },
    t('post.back'));

  const meta = bylineBits(post, creator);
  if (me && post.pubkey === me) meta.push(deleteControl(post, onDelete, onBack));

  const images = extractImageUrls(post.content);
  const text = images.reduce((s, url) => s.replace(url, ''), post.content).trim();
  const children = [
    el('div', { class: 'view-head' }, back),
    deleted ? el('p', { class: 'deleted-banner' }, t('community.deleted_banner')) : null,
    el('h1', { class: 'post-detail-title' }, post.title),
    el('div', { class: 'muted post-meta' }, meta),
    renderBody(text),
  ];
  for (const url of images) {
    children.push(isEncryptedImageUrl(url) ? encryptedImageNode(url, onLoadImage) : plainImageNode(url));
  }
  // Up/down bar sits between the post body and the thread, centered.
  if (onReact) children.push(reactionBar(post, onReact, onUnreact));
  children.push(renderComments(post, comments, { me, creator, onReply, onDelete, page, onLoadMore }));
  return el('section', { class: 'post-detail' }, children);
}

function plainImageNode(url) {
  return el('a', { href: url, target: '_blank', rel: 'noopener noreferrer' },
    el('img', { class: 'post-image', src: url, loading: 'lazy', alt: '' }));
}

// Encrypted image: the media server holds only ciphertext, so the browser
// fetches it, decrypts it locally and shows it via a blob: URL. The object URL
// is kept alive (not revoked) so the click-to-open link keeps working; it is
// reclaimed when the page unloads. A placeholder marks the fetch+decrypt time
// so the post never looks silently truncated.
function encryptedImageNode(url, onLoadImage) {
  const placeholder = el('p', { class: 'muted' }, t('post.image_loading'));
  onLoadImage(url)
    .then(async (blob) => {
      const img = el('img', { class: 'post-image', alt: '' });
      const src = URL.createObjectURL(blob);
      img.src = src;
      // Last defense layer: expose the click-to-open link only after the
      // browser's own decoder accepted the bytes as an image. Anything else
      // is revoked before it is ever navigable.
      try {
        await img.decode();
      } catch (err) {
        URL.revokeObjectURL(src);
        throw err;
      }
      placeholder.replaceWith(el('a', { href: src, target: '_blank', rel: 'noopener noreferrer' }, img));
    })
    .catch(() => placeholder.replaceWith(el('p', { class: 'muted' }, t('post.image_unavailable'))));
  return placeholder;
}

// Render body text with bare http(s) URLs turned into links. Clicking a link
// does not navigate directly: relay content is hostile, so we warn the user
// which external host they are about to open first (CLAUDE.md §5).
function renderBody(text) {
  const nodes = linkifySegments(text).map((s) =>
    (s.url != null ? linkNode(s.url) : document.createTextNode(s.text)));
  return el('div', { class: 'post-body' }, nodes);
}

function linkNode(url) {
  return el('a', {
    href: url,
    class: 'body-link',
    onClick: async (e) => {
      e.preventDefault();
      if (await showConfirm(t('post.link_warning', { url }))) {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    },
  }, url);
}

function deleteControl(post, onDelete, onBack) {
  const btn = deleteButton({
    labelKey: 'post.delete',
    confirmKey: 'post.delete_confirm',
    run: async (b) => {
      const accepted = await onDelete(post);
      b.replaceWith(el('span', { class: 'muted' }, t('post.deleted', { count: accepted })));
      if (accepted > 0) setTimeout(onBack, 800);
    },
  });
  return el('span', {}, [dot(), btn]);
}
