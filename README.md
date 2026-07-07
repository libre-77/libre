**English** · [한국어](README.ko.md)

# libre

**Communities that can't be silenced.**

libre is a decentralized, censorship-resistant community app (Reddit-style forums)
built on the [Nostr](https://nostr.com) protocol. There is no central server to
seize, no company to pressure, and no single domain to block. Posts live on relays
run by independent operators around the world. Your identity is a key you control.

## Why

More and more governments are reaching for laws that let them order speech taken
down: punitive damages and fines wrapped around vaguely defined "false" or
"manipulated" information, with takedown, reporting, and moderation duties pushed
onto large platforms. The criteria are often loose enough that critics warn they
become a switch for silencing legitimate speech.

libre is a direct answer: **build the switch out of existence.** If no one can be
ordered to take content down, because there is no central operator, no company,
and no chokepoint, then there is nothing to switch off.

## How it works

- **Content lives on Nostr relays**, not on a libre server. libre is just static
  HTML + JavaScript you can host anywhere or run locally.
- **Communities use NIP-72** (moderated communities): a community is an addressable
  event (`kind 34550`); posts and replies are NIP-22 comments (`kind 1111`) scoped
  to it.
- **You own your key.** Log in with a NIP-07 browser extension, or generate a local
  identity. Keys never leave your device.
- **Relays are yours to choose.** Ship with defaults across multiple jurisdictions;
  add your own. As long as one relay stays up, the community survives.

## Design

Deliberately plain, like Hacker News rather than a landing page. System fonts, minimal CSS,
no framework, no tracking, no third-party calls at runtime except to the relays
and media hosts you configure. Multilingual from day one (English + Korean).

## Run it locally

```bash
cd web
npm install          # build-time only: bundles nostr-tools
npm run build:vendor # -> web/vendor/nostr-tools.js (committed)
# serve the static folder with anything:
npx serve .          # or: python3 -m http.server
```

Open the printed URL. That's the whole app: static files talking to relays.

## Run a relay (grow the network)

More independent relays = more censorship resistance. On any VPS **outside** the
censoring jurisdiction:

```bash
cd relay
# edit Caddyfile + strfry.conf with your domain
docker compose up -d
```

Then add your `wss://your-domain` in libre → **relays**. See
[`docs/deploy.md`](docs/deploy.md).

## Deploy the client (many doors)

Host `web/` on any static host **and** pin it to IPFS, and expose a `.onion`.
Multiple entry points mean no single block kills access. See
[`docs/deploy.md`](docs/deploy.md) and [`docs/threat-model.md`](docs/threat-model.md).

## If the site gets blocked

Blocking a website does not destroy libre. It is just files. Keep a copy of the
built `index.html` (or the project ZIP) somewhere safe, and you can run it on your
own computer at any time. It still connects straight to the relays and keeps
working, with no website in the loop. Plain step-by-step for non-technical users,
including how to open it on a phone:
[Run libre on your own computer](docs/deploy.md#if-the-website-gets-blocked-run-libre-on-your-own-computer).

## Contributing

Read [`CLAUDE.md`](CLAUDE.md) first. It is the binding engineering guide (layered
architecture, vanilla-JS-only, no runtime third-party hosts, i18n-first, plain
design). PRs that weaken censorship resistance or add framework/CDN dependencies
will not be merged.

## License

[AGPL-3.0-or-later](LICENSE). See [`NOTICE`](NOTICE) for origin and third-party
attribution. The AGPL is intentional: anyone who runs a modified libre as a service
must share their changes, so forks stay open, which strengthens the network.

> This is a tool for lawful speech and press freedom. It is not a shield for
> defamation or illegal content. Know the law in your jurisdiction.
