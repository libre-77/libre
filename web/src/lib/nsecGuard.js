// SPDX-License-Identifier: AGPL-3.0-or-later
// Pure detector for accidental private-key exposure. An `nsec…` is a bech32
// secret key: if it ever reaches a relay it is public forever and the account
// is compromised. UGC submit paths run text through this before publishing so
// the user can catch a fat-fingered paste. Pure + dependency-free (CLAUDE.md §4).

// `nsec1` followed by the bech32 data part. The charset excludes 1/b/i/o; a real
// secret key carries 58 data chars, so the length floor keeps ordinary prose
// (e.g. the word "nsec" in a sentence) from matching.
const NSEC_RE = /nsec1[023456789acdefghjklmnpqrstuvwxyz]{58,}/i;

/** True if `text` contains something that looks like an `nsec…` private key. */
export function containsNsec(text) {
  return typeof text === 'string' && NSEC_RE.test(text);
}
