// Vendor entry for libre. esbuild bundles this into vendor/nostr-tools.js (ESM).
// This is the ONLY surface of nostr-tools the app is allowed to touch; import from
// '../vendor/nostr-tools.js' everywhere else. Keeping the surface small keeps the
// bundle lean and the protocol boundary explicit (see CLAUDE.md §2, §4).
export { SimplePool } from 'nostr-tools/pool';
export {
  finalizeEvent,
  getPublicKey,
  generateSecretKey,
  verifyEvent,
} from 'nostr-tools/pure';
export * as nip19 from 'nostr-tools/nip19';
export * as nip05 from 'nostr-tools/nip05';
