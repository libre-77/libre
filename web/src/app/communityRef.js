// SPDX-License-Identifier: AGPL-3.0-or-later
// The compact community reference persisted by favorites/recents and rebuilt
// by their list views: enough to link back (#/c/pubkey/identifier) and label
// the link, nothing more.

import { communityAddr } from '../nostr/communities.js';

/** Pick the reference fields for a community (addr computed when missing). */
export function communityRef(c) {
  return {
    addr: c.addr ?? communityAddr(c),
    pubkey: c.pubkey,
    identifier: c.identifier,
    name: c.name,
  };
}
