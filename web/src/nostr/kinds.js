// NIP-72 (Moderated Communities) event kinds and tag names.
// Single source of truth - no magic numbers elsewhere (CLAUDE.md §5).
// Verified against NIP-72 and reference/chorus/src/lib/nostr-kinds.ts.

export const KIND = {
  METADATA: 0, // NIP-01 profile (kind 0)
  REACTION: 7, // NIP-25 like/reaction
  DELETION: 5, // NIP-09 deletion request (best-effort; relays may ignore)
  REPORT: 1984, // NIP-56 report

  // Community discussion uses NIP-22 comments (kind 1111) tagged to the community.
  COMMENT: 1111, // a post or a reply, distinguished by which tags it carries

  // NIP-72 moderation events (author = a moderator).
  POST_APPROVAL: 4550,
  POST_REMOVAL: 4551,
  JOIN_REQUEST: 4552,
  LEAVE_REQUEST: 4553,

  // Addressable (kind 3xxxx) community + membership lists.
  COMMUNITY: 34550, // community definition + moderator list
  APPROVED_MEMBERS: 34551,
  DECLINED_MEMBERS: 34552,
  BANNED_MEMBERS: 34553,
  PINNED_POSTS: 34554,
  PINNED_COMMUNITIES: 34555,
};

// Tag names we read/write. Keeps stringly-typed tags in one place.
export const TAG = {
  IDENTIFIER: 'd', // addressable event identifier
  ADDRESS: 'a', // community coordinate reference (34550:pubkey:d)
  ROOT_KIND: 'K', // NIP-22 root scope kind
  ROOT_ADDRESS: 'A', // NIP-22 root scope address
  ROOT_EVENT: 'E', // NIP-22 root event: the top-level post a reply's thread hangs off
  // (libre addition; chorus roots everything at the community only. Without it a
  // reply whose parent comment never arrived cannot be attributed to its post,
  // so it would vanish silently - see docs/decisions.md.)
  PARENT_KIND: 'k', // NIP-22 parent kind
  PARENT_EVENT: 'e', // reply parent event id
  SUBJECT: 'subject', // NIP-14 post title/subject
  PUBKEY: 'p',
  NAME: 'name',
  DESCRIPTION: 'description',
  IMAGE: 'image',
  MODERATOR: 'p', // in a COMMUNITY event, p-tag with role 'moderator'
};

export const ROLE_MODERATOR = 'moderator';

// libre namespace marker (NIP-12 't' hashtag). Communities created in libre
// carry ["t", NAMESPACE] so the list can show only this instance's communities
// instead of every kind-34550 community on shared public relays. Not a security
// boundary - anyone can add the same tag - just a discovery filter. The random
// suffix isolates us from the generic "libre" tag other test data reuses; it is
// a fixed build-time constant (never regenerate, or existing communities vanish).
export const NAMESPACE = 'libre-4d1c8a2fee';
