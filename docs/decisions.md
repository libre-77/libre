**English** · [한국어](decisions.ko.md)

# Decisions

Short log of choices that shape libre. New dependencies and architecture calls go
here (per CLAUDE.md).

## Protocol: Nostr, NIP-72

Nostr gives client-owned keys and dumb, swappable relays: the strongest fit for
"no central takedown point." NIP-72 models Reddit-style moderated communities
(`kind 34550` community, `kind 1111` NIP-22 comments for posts/replies, `kind 4550`
approvals). Alternatives considered: ActivityPub/Lemmy (federated but has operator
chokepoints), Farcaster (hybrid, on-chain dependency). Nostr won on simplicity and
censorship resistance.

## Frontend: vanilla JS + HTML, no framework

Requirement: fast to build, simple, Hacker-News-plain, no "AI slop" design. A
framework (React/Vue) adds build complexity and a heavier attack surface for no
benefit here. The app is small; plain ES modules + a tiny DOM helper suffice and
keep the static-files invariant trivially true.

## Dependencies

- **nostr-tools** (MIT): the one runtime library. Proven, audited crypto/relay
  code; we do not hand-roll signing, bech32, or relay framing. **Vendored**: bundled
  once via esbuild into `web/vendor/nostr-tools.js` (committed) so runtime needs no
  npm and no CDN.
- **esbuild** (dev only): bundles the vendor file. Not shipped.
- **JetBrains Mono** (SIL OFL 1.1): UI font. **Vendored**: `.woff2` files
  committed at `web/vendor/fonts/`, loaded via `@font-face` + relative `url()` in
  dev, inlined as base64 `data:` URIs into the single-file dist by `build.js`.
  No Google Fonts / CDN fetch at runtime.
- No other runtime dependencies. Adding one requires a note here and must not
  introduce a runtime third-party host.

## Relay: strfry

Battle-tested C++ relay, easy Docker deploy, doubles as a Blossom media server.
NIP-72 needs no special relay support (relays just store the event kinds), so any
compliant relay works; strfry is the recommended default. Fronted by Caddy for
automatic WSS.

## Licensing: AGPL-3.0-or-later

Network-copyleft: anyone running a modified libre as a service must publish changes,
so forks stay open and the network compounds. libre ships no third-party app code;
`reference/chorus` is study-only and excluded from distribution (see NOTICE,
.gitignore).

## i18n: JSON tables + `t()`, English source of truth

Global audience. Flat dotted keys in `web/i18n/<locale>.json`, `Intl` for dates,
logical CSS properties for RTL. Adding a language = one JSON file. Ship `en` + `ko`.

## Deferred (not in MVP)

- In-app moderation UI (approvals/bans/reports): logic exists in the protocol
  (`kind 4550/4551/34553`); client UI is future work.
- Multiple / burner identities with quick switching.

## Shipped after MVP

- **Namespace filter**: communities carry a `["t","libre"]` tag; the list queries
  `#t:["libre"]` so libre shows only its own communities, not every kind-34550 on
  shared relays. Discovery filter, not a security boundary.
- **Post deletion**: NIP-09 (kind 5) request on your own posts. Best-effort:
  relays that honor it drop the event; copies elsewhere may survive.
- **Image upload**: Blossom (BUD-02): sha256 content-addressed blobs to a
  user-editable media-server list (default blossom.band, blossom.nostr.build).
  Image URLs in posts render as `<img>`. Auth via signed kind-24242 event.
  Images are re-encoded through a canvas before upload to strip EXIF (GPS/device).
- **Encrypted local key**: the local nsec is no longer stored in plaintext.
  It is AES-GCM encrypted under a PBKDF2 (210k) passphrase key and the ciphertext
  lives in IndexedDB; the passphrase is never stored and must be re-entered to
  unlock (in-memory for the session only). Legacy plaintext localStorage keys are
  wiped on load. NIP-07 remains the most secure path. Login now warns about IP
  exposure (use Tor/VPN) and post permanence.
- **Thread-root `E` tag on replies**: chorus roots every comment at the
  community (`A` tag) only, so a reply cannot be attributed to its post unless
  the whole parent chain was received. Relay sets of two users need not overlap
  fully, so a missing parent made whole subtrees vanish silently. libre replies
  now also carry `["E", <top-level post id>]` (NIP-22 root event); the comment
  view pins such orphans at top level with an "unreceived parent" note. Events
  from before this change (or from chorus) lack the tag and stay unattributable.
  The relays settings page also warns when only one relay is configured, since a
  single relay is a single point of failure, censorship and surveillance.
