# libre: Engineering Guide & Coding Rules

> Censorship-resistant, decentralized community app built on Nostr (NIP-72).
> Frontend: **plain HTML + vanilla JavaScript**. No framework. Hacker News aesthetic.
> These rules are binding. Read them before writing or reviewing any code.

---

## 1. Mission & Non-Negotiables

libre exists so a community can keep talking when a central authority tries to
silence it. Every technical decision is judged against that goal.

- **No single point of takedown.** No central app server holds content. The client
  is static files; content lives on Nostr relays. The user can add/remove relays.
- **No hard dependency on any one domain, host, CDN, or app store.** Anything the
  app needs at runtime must be either (a) bundled into the static build, or
  (b) reachable through a user-editable, multi-endpoint list.
- **Runtime has zero third-party network calls except to Nostr relays and
  user-configured media hosts.** No analytics, no Google Fonts, no CDN scripts, no
  telemetry. A request to any other host is a bug.
- **License: AGPL-3.0-or-later.** Preserve the upstream MIT notice for any code
  derived from `reference/chorus` (see §11). New files carry an AGPL SPDX header.
- **The user owns their keys.** Private keys never leave the device unencrypted and
  are never transmitted. Prefer NIP-07 (browser extension) when available.

If a change weakens any bullet above, it does not merge, regardless of how
convenient it is.

---

## 2. Technology Constraints

**Do use:**
- Plain HTML5 + vanilla JavaScript (ES modules, `type="module"`). Target modern
  evergreen browsers. No transpilation of app code.
- `nostr-tools` as the ONLY heavy dependency, **vendored** into `web/vendor/` via a
  single esbuild bundle step. It is the proven, audited Nostr library, so do not
  hand-roll cryptography, event signing, bech32, or relay framing.
- Minimal, hand-written CSS in one file. System font stack. No CSS framework.

**Do NOT use, add, or reintroduce:**
- Any UI framework or reactivity lib (React, Vue, Svelte, Solid, lit, jQuery, Alpine).
- Any CSS framework or design system (Tailwind, Bootstrap, shadcn, Material).
- Any runtime CDN import (`esm.sh`, `unpkg`, `cdn.jsdelivr`, Google Fonts, etc.).
- A build framework for app code. Two esbuild steps are allowed and are the only
  build steps: (a) bundling `nostr-tools` into `web/vendor/`, and (b) the
  distribution build (`npm run build` → `build.js`) that bundles the layered
  source + inlines CSS and the i18n tables into a single self-contained
  `web/dist/index.html`. No transpilation of app semantics; no other tooling.
- New npm dependencies without an explicit decision recorded in `docs/decisions.md`.
  Every dependency is runtime attack surface and supply-chain risk.

The litmus test: **the app must run by serving the `web/` folder as static files**,
with no server-side logic, from any static host or IPFS. If a feature breaks that,
redesign the feature.

Distribution: `npm run build` emits `web/dist/index.html`, a single self-contained
file (CSS + JS + i18n inlined) for one-file hosting/IPFS mirroring. It must be
served over **http(s)** (or an IPFS gateway), not opened via `file://`, where the
browser disables `crypto.subtle` (secure-context rule) and key encryption can't
run. The build inlines the i18n tables as a read-only `globalThis.__LIBRE_I18N`
constant; this is the one sanctioned global (a build-time constant, not mutable
app state) and exists only so the single file needs zero runtime fetches.

---

## 3. Design Rules: Hacker News, not AI Slop

The look is deliberately plain. Information density over decoration.

- Model the visual language on Hacker News / early Craigslist / plain forums:
  system fonts, left-aligned text, thin rules, lists and simple tables.
- **Minimal CSS.** No gradients, no drop shadows, no glassmorphism, no rounded
  "card" pileups, no hero sections, no emoji-as-UI, no animated anything, no
  purple-to-blue gradient buttons. These are the tells of AI slop: banned.
- Color: near-monochrome. One muted accent color, used sparingly for links/actions.
  Respect `prefers-color-scheme` for dark mode with the same restraint.
- Layout: a single constrained column (~`70ch`) for reading. Native controls where
  possible. Buttons look like buttons or plain links.
- Every visual element must justify itself by function. If it is decoration, cut it.
- No layout shift, no spinners-for-everything. Show text as soon as data arrives.

When in doubt, make it plainer.

---

## 4. Architecture: Layered, No Spaghetti

Strict one-directional dependency flow. A lower layer never imports an upper one.

```
  ui/  (render + events)   ──imports──▶  app/ (state, controllers)
  app/                     ──imports──▶  nostr/ (protocol) , i18n/ , lib/
  nostr/  (NIP logic)      ──imports──▶  vendor/nostr-tools , lib/
  lib/   (pure helpers)    ──imports──▶  (nothing app-specific)
```

Rules that keep it clean:

- **`nostr/` is the only place that knows Nostr exists.** Event kinds, tags, filters,
  relay pools, signing: all isolated here. It exposes plain data + plain functions
  (e.g. `fetchCommunities()`, `postToCommunity()`), never leaks raw events upward
  unless wrapped in a typed shape defined in `nostr/types.js`.
- **`ui/` never talks to relays and never touches `nostr-tools` directly.** It renders
  data and emits user intents to `app/`.
- **`app/` orchestrates.** It calls `nostr/`, holds view state, and hands plain data to
  `ui/`. No DOM in `app/`; no protocol code in `app/`.
- **`lib/` is pure and dependency-free** (formatting, time, url parsing, small utils).
  No DOM, no network, no global state. Trivially unit-testable.
- **No globals.** State lives in explicit modules and is passed in. No `window.*`
  stash. The one allowed singleton is the relay pool, created in `nostr/pool.js`.
- **One responsibility per module. Hard file-size ceiling: 200 lines.** If a file
  grows past it, split by responsibility, not by arbitrary cut. Functions ≤ 40 lines.
- **No circular imports.** If two modules need each other, extract the shared piece
  into `lib/` or pass a callback.
- Data flows one way: relay → `nostr/` → `app/` state → `ui/` render. User events go
  `ui/` → `app/` → `nostr/`. Never shortcut this loop.

Directory layout:

```
web/
  index.html              # single entry, loads /src/main.js as a module
  src/
    main.js               # boot: wire app + ui, mount router
    app/                  # controllers + view state (no DOM, no protocol)
    ui/                   # DOM rendering + event binding (no relays)
    nostr/                # NIP-72 logic over vendored nostr-tools
    i18n/                 # loader + helpers (strings live in web/i18n/*.json)
    lib/                  # pure helpers
  vendor/                 # bundled nostr-tools (generated, committed)
  styles/style.css        # the one stylesheet
  i18n/                   # en.json, ko.json, ... (translation data)
  manifest.webmanifest    # PWA
  sw.js                   # service worker (offline shell)
reference/chorus/         # READ-ONLY. NIP-72 logic reference (React). Do not import.
relay/                    # strfry docker-compose + config for self-hosting
docs/                     # decisions.md, threat-model.md, deploy.md
```

---

## 5. Nostr / NIP-72 Rules

- Follow **NIP-72 (Moderated Communities)** for the data model:
  community definition `kind 34550`, post approval `kind 4550`, posts/replies via
  `kind 1111` (NIP-22) tagged to the community `a`-tag. Verify exact kinds/tags
  against `reference/chorus` and the current NIP-72 spec before implementing.
  Do not trust memory.
- All event kinds and tag names are named constants in `nostr/kinds.js`. No magic
  numbers scattered in code.
- Relays are a user-editable list with sane censorship-resistant defaults (multiple
  jurisdictions, none in the target-censorship jurisdiction). Reads use a pool and
  tolerate any subset being down. Never assume a specific relay is reachable.
- Validate every incoming event before use (signature is checked by nostr-tools;
  you still validate required tags/shape). Treat relay data as hostile input.
- Never block the UI on the network. Render optimistically where safe, reconcile on
  arrival.

---

## 6. Internationalization (i18n): First-Class

The audience is global and multilingual. i18n is not an afterthought.

- **No hardcoded user-facing string anywhere in `ui/` or `app/`.** Every visible
  string goes through the translator: `t('key')`. A literal in a template that a
  user can see is a bug.
- Translation data lives in `web/i18n/<locale>.json` as flat, dotted keys
  (`community.create.title`). `en.json` is the source of truth and must contain
  every key. Missing keys fall back to `en`, then to the key itself.
- The i18n module: detects locale (`navigator.language`, user override in
  localStorage), loads the JSON, exposes `t(key, params)` with `{param}`
  interpolation. Keep it under 200 lines and dependency-free.
- Interpolate variables (`t('post.by', {name})`). Never build sentences by string
  concatenation, which breaks in other languages' word order.
- Format dates/numbers with the platform `Intl` API and the active locale. No
  hardcoded date formats.
- Design for RTL from the start: use logical CSS properties
  (`margin-inline-start`, not `margin-left`) and set `dir` on `<html>` per locale.
- Ship `en` and `ko` at launch. Adding a language = adding one JSON file, nothing else.

---

## 7. JavaScript Style

- ES modules only. `const` by default, `let` when reassigned, never `var`.
- Prefer pure functions. Isolate side effects (DOM, network) at the edges.
- Name honestly: `fetchApprovedMembers`, not `getData`. No abbreviations that aren't
  domain-standard (`npub`, `nip05` are fine).
- Fail loudly in dev: validate inputs, throw on invariant violations. Never swallow
  errors silently; surface a user-facing message via the i18n layer.
- No clever one-liners that need a comment to decode. Clarity beats brevity.
- Comments explain **why**, not **what**. Delete commented-out code.
- DOM building: small explicit helpers or `<template>` elements. **Never** set
  untrusted content via `innerHTML`. Use `textContent`; sanitize any rendered
  markdown. XSS from relay content is the primary client threat.
- Keep `main.js` a thin wiring layer. Logic lives in the layers, not the entry point.

---

## 8. Testing & Verification

- `lib/` and `nostr/` pure functions get unit tests (plain `node --test`, no heavy
  runner). Protocol encoding/decoding especially.
- Before claiming a feature works, run it against a real/local relay and observe the
  actual behavior, not just a passing type check. Evidence over assertion.
- Manually verify the "static-files-only" invariant after any dependency change:
  serve `web/` with a dumb static server and confirm no request leaves for a
  non-relay host (check the network panel).

---

## 9. Build & Deploy

- One build command: bundle `nostr-tools` → `web/vendor/nostr-tools.js`
  (esbuild, ESM, minified). The output is committed so the app runs without npm.
- Deploy = copy `web/` to any static host **and** pin to IPFS. Provide multiple
  entry points (domains + IPFS gateway + `.onion`) so no single block kills access.
- The service worker caches the app shell for offline load and resilience against
  host takedown, but never caches or proxies another host's runtime code.
- `relay/` ships a `docker-compose.yml` so anyone can run a relay in one command.
  More independent relays means more censorship resistance. Document it in `docs/deploy.md`.
- **Git commits are written in English.** Subject and body, Conventional Commits
  format (`type(scope): summary`). This is a hard rule regardless of any tool or
  skill default: the project history stays in one language for global contributors.

---

## 10. Definition of Done

A change is done only when:
- It upholds every non-negotiable in §1 and the static-files invariant in §2.
- No new runtime third-party host; no new npm dep without a recorded decision.
- All user-facing strings are translated keys; `en.json` has them.
- Files ≤ 200 lines, functions ≤ 40, layering respected, no circular imports.
- Design stays in the §3 plain aesthetic. No slop crept in.
- Behavior was actually exercised against a relay, not just assumed.

---

## 11. Using `reference/chorus`

`reference/chorus` is the upstream MIT-licensed React app (andotherstuff/chorus). It
is a **read-only reference** for how NIP-72 flows work (membership, approvals, bans,
reports). **Do not import from it and do not copy its React patterns.** If you port a
specific algorithm or event-construction detail from it, keep the MIT copyright notice
alongside that code and note the origin. Everything we ship is vanilla JS under AGPL.
