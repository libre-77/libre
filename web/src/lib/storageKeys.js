// SPDX-License-Identifier: AGPL-3.0-or-later
// Every localStorage key libre persists, in one place. The "delete all local
// data" wipe iterates these values, so a key added here is automatically
// covered - defining a key anywhere else risks it surviving the wipe.

export const STORAGE_KEYS = {
  recents: 'libre.recent_communities',
  favorites: 'libre.favorite_communities',
  relayConsent: 'libre.relay_consent',
  relays: 'libre.relays',
  mediaServers: 'libre.mediaServers',
  locale: 'libre.locale',
};
