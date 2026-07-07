// Hash router + controller glue. Parses the route, fetches data via actions,
// then hands plain data to a ui view. This is the only place app-state meets
// rendering; views stay free of protocol and fetching (CLAUDE.md §4).

import { el, mount } from '../lib/dom.js';
import { t } from '../i18n/index.js';
import { placeholderCommunity } from '../nostr/parse.js';
import * as actions from './actions.js';
import { currentPubkey } from './session.js';
import { getRecent, recordVisit } from './recents.js';
import { getFavorites, isFavorite, toggleFavorite } from './favorites.js';
import { hasRelayConsent, grantRelayConsent } from './consent.js';
import { renderConsentGate } from '../ui/views/gate.js';
import { renderCommunities } from '../ui/views/communities.js';
import { renderCommunity } from '../ui/views/community.js';
import { renderPostDetail } from '../ui/views/post.js';
import { renderNewCommunity, renderRelays } from '../ui/views/forms.js';
import { renderProfile } from '../ui/views/profile.js';
import { renderAbout } from '../ui/views/about.js';
import { renderSettings } from '../ui/views/settings.js';

let viewRoot = null;
let onConsentGranted = null;

export function start(root, onConsent) {
  viewRoot = root;
  onConsentGranted = onConsent;
  window.addEventListener('hashchange', route);
  route();
}

export function navigate(hash) {
  window.location.hash = hash;
}

/** Re-run the current route (e.g. after a locale change) to refresh strings. */
export function rerender() {
  return route();
}

function loading() {
  mount(viewRoot, el('p', { class: 'muted' }, t('loading')));
}

// Show the relay/IP warning and hold here. On accept, persist the consent and
// re-run the route so the intended view loads (now free to hit relays).
function showConsentGate() {
  mount(viewRoot, renderConsentGate({
    onContinue: () => { grantRelayConsent(); onConsentGranted?.(); route(); },
  }));
}

async function route() {
  // Opsec gate: no route may reach relay-connecting logic until the user has
  // acknowledged that relays see their IP (consent.js). Blocks the whole app on
  // first entry, then never again on this device.
  if (!hasRelayConsent()) return showConsentGate();
  const parts = (window.location.hash.replace(/^#\/?/, '') || '').split('/');
  try {
    if (parts[0] === '' ) return await showCommunities();
    if (parts[0] === 'new') return mount(viewRoot, renderNewCommunity({ onCreate: createCommunity }));
    if (parts[0] === 'relays') return mount(viewRoot, renderRelays());
    if (parts[0] === 'profile') return await showProfile();
    if (parts[0] === 'settings') return mount(viewRoot, renderSettings());
    if (parts[0] === 'about') return mount(viewRoot, renderAbout());
    if (parts[0] === 'c' && parts[1] && parts[2] && parts[3]) return await showPost(parts[1], parts[2], parts[3]);
    if (parts[0] === 'c' && parts[1] && parts[2]) return await showCommunity(parts[1], parts[2]);
    return await showCommunities();
  } catch (err) {
    mount(viewRoot, el('p', { class: 'error' }, t('error.load_failed')));
    console.error(err);
  }
}

async function showCommunities() {
  loading();
  const { items, hasMore, nextUntil } = await actions.listCommunities();
  mount(viewRoot, renderCommunities(items, {
    onOpen: openCommunity,
    page: { hasMore, nextUntil },
    onLoadMore: (until) => actions.listCommunities({ until }),
    recent: getRecent(),
    favorites: getFavorites(),
    onToggleFavorite: toggleFavorite,
  }));
}

async function showCommunity(pubkey, identifier) {
  loading();
  // Posts are addressed by 34550:pubkey:identifier - both known from the route -
  // so fetch them in parallel with the community metadata instead of after it.
  const stub = { pubkey, identifier };
  const [fetched, page] = await Promise.all([
    actions.getCommunity(pubkey, identifier),
    actions.listPosts(stub),
  ]);
  // A community can't be deleted in libre, but a NIP-09 event crafted elsewhere
  // may drop the kind-34550 definition from relays. The board must survive that:
  // fall back to a placeholder so the members' posts stay visible and postable.
  const community = fetched ?? placeholderCommunity(pubkey, identifier);
  recordVisit(community);
  mount(
    viewRoot,
    renderCommunity(community, page.items, {
      onPost: (content, title) => actions.createPost(community, content, title),
      onUpload: (file) => actions.uploadImage(file),
      onOpenPost: (post) => navigate(`#/c/${pubkey}/${identifier}/${post.id}`),
      onBack: () => navigate('#/'),
      page: { hasMore: page.hasMore, nextUntil: page.nextUntil },
      onLoadMore: (until) => actions.listPosts(stub, { until }),
      favorite: isFavorite(community),
      onToggleFavorite: () => toggleFavorite(community),
    }),
  );
}

async function showPost(pubkey, identifier, postId) {
  loading();
  // Community, post and the comment thread are all addressable from the route,
  // so fetch the three in parallel - one round trip instead of two.
  const stub = { pubkey, identifier };
  const [fetched, post, thread] = await Promise.all([
    actions.getCommunity(pubkey, identifier),
    actions.getPost(postId),
    actions.listThread(stub),
  ]);
  if (!post) return mount(viewRoot, el('p', { class: 'error' }, t('post.empty')));
  // Post outlives its community: render it even if the definition event is gone.
  const community = fetched ?? placeholderCommunity(pubkey, identifier);
  mount(
    viewRoot,
    renderPostDetail(post, thread.items, {
      me: currentPubkey(),
      creator: community.pubkey,
      deleted: community.deleted,
      onDelete: (p) => actions.deletePost(p).then((r) => r.accepted),
      onReply: (parent, content) => actions.createReply(community, post, parent, content),
      onReact: (direction) => actions.react(post, direction),
      onUnreact: (reactionId) => actions.unreact(reactionId),
      onLoadImage: (url) => actions.loadEncryptedImage(url),
      onBack: () => navigate(`#/c/${pubkey}/${identifier}`),
      page: { hasMore: thread.hasMore, nextUntil: thread.nextUntil },
      onLoadMore: (until) => actions.listThread(stub, { until }),
    }),
  );
}

async function showProfile() {
  const pubkey = currentPubkey();
  if (!pubkey) return mount(viewRoot, renderProfile({}, { onSave: actions.saveProfile }));
  loading();
  const profile = await actions.getProfile(pubkey);
  mount(viewRoot, renderProfile(profile, { onSave: actions.saveProfile }));
}

function openCommunity(c) {
  navigate(`#/c/${c.pubkey}/${c.identifier}`);
}

async function createCommunity(data) {
  const { community, accepted } = await actions.newCommunity(data);
  if (accepted === 0) throw new Error('publish-failed'); // no relay stored it
  openCommunity(community);
}
