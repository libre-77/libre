**English** · [한국어](deploy.ko.md)

# Deploying libre

libre has two independent pieces: the **client** (static files) and **relays**
(where content lives). Neither is a single point of failure by design.

## 1. Build the client

```bash
cd web
npm install
npm run build:vendor   # produces web/vendor/nostr-tools.js
```

The result is the `web/` folder: pure static files, no server logic.

### Single-file build (simplest to host/mirror)

```bash
npm run build          # -> web/dist/index.html
```

`dist/index.html` is one self-contained file (CSS + JS + all i18n inlined) with
zero external references. Host that one file anywhere, or `ipfs add` it. It must
be served over **http(s)** or an IPFS gateway, not opened via `file://`, because
browsers disable `crypto.subtle` (needed for key encryption) outside a secure
context. `dist/` also gets `sw.js`, `manifest.webmanifest`, and `icon.svg` copied
alongside so an HTTP host still gets the PWA; the single `index.html` works
without them.

## 2. Publish the client to many doors

Censorship resistance comes from multiple entry points. Do as many as you can:

- **Static hosts** (multiple, different providers/countries): copy `web/` up.
- **IPFS**: `ipfs add -r web` and pin the CID (also pin on a pinning service).
  Share the CID and a gateway URL.
- **Tor**: serve `web/` from an onion service for a `.onion` address.
- **Direct download**: zip `web/` so users can self-host or run it offline.

Because the app is static and same-origin only, any of these "just works": it
only ever talks to the relays and media hosts the user configures.

### GitHub Pages (free hosting from your repository)

GitHub can host the site for you, for free, straight from the repository. You do
not need your own server.

1. Create a free account at [github.com](https://github.com) and upload this
   project as a repository (GitHub's "upload files" button works if you are not
   used to git).
2. In the repository, click **Settings** (top menu), then **Pages** (left menu).
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.
4. Add one file to the repository at `.github/workflows/pages.yml` with the
   contents below, then save. You do not need to understand it; it just tells
   GitHub to publish the `web/` folder.

   ```yaml
   name: Deploy to Pages
   on:
     push:
       branches: [main]
   permissions:
     contents: read
     pages: write
     id-token: write
   jobs:
     deploy:
       runs-on: ubuntu-latest
       environment:
         name: github-pages
         url: ${{ steps.deploy.outputs.page_url }}
       steps:
         - uses: actions/checkout@v4
         - uses: actions/configure-pages@v5
         - uses: actions/upload-pages-artifact@v3
           with:
             path: web
         - id: deploy
           uses: actions/deploy-pages@v4
   ```

5. Wait a minute. GitHub shows your address on the **Pages** settings page,
   something like `https://<your-name>.github.io/<repo>/`. That is your live
   libre site. Share the link.

The address starts with `https://`, which is required for the login/key features
to work. Nothing extra to build or configure.

**Do not rely on this one link alone.** GitHub can be blocked or can take the page
down. Whenever you can, also put the site on one more place from the list above
(IPFS, another static host, or a `.onion` address), and read the next section so
you can always fall back to running it on your own computer.

### If the website gets blocked: run libre on your own computer

Blocking a website does **not** destroy libre. The whole app is just a set of
files. If you keep a copy, you can open it on your own computer at any time and it
still connects to the relays and keeps working, with no website involved.

**Keep a copy now, before you need it.** Ask someone technical to send you the
single file `index.html` that this project builds (it is complete on its own), or
download the whole project as a ZIP from GitHub. Save it somewhere safe, such as a
USB stick. Put that `index.html` into a folder, for example a folder named `libre`
on your Desktop.

There are two ways to open it, depending on which screen you want to use.

#### A. Open it on the same computer (simplest)

You only type one command. The words after `#` are explanations, do not type them.

**On a Mac:**

1. Open the **Terminal** app (press `Cmd + Space`, type `Terminal`, press Enter).
2. Copy-paste this line and press Enter:

   ```bash
   cd ~/Desktop/libre && python3 -m http.server 8099
   ```

   (`cd ...` moves into your folder; the rest starts a tiny local website on your
   own computer.)
3. Open your web browser and go to: `http://localhost:8099`

**On Windows:**

1. Open the **Command Prompt** (press the Windows key, type `cmd`, press Enter).
2. Copy-paste this line and press Enter:

   ```bat
   cd C:\libre && python -m http.server 8099
   ```

3. Open your web browser and go to: `http://localhost:8099`

If your computer says `python` is not found, install it once from
[python.org](https://www.python.org/downloads/) (on Windows, tick **"Add Python
to PATH"** during install), then try again. Python is a small free program many
computers already have.

Do not open the file by double-clicking it. Opened that way the browser turns off
the security features libre needs to protect your key. Always use the
`http://localhost:8099` address above.

#### B. Open it on your phone or another device (needs HTTPS)

To reach the site from a **phone or a second computer** on the same Wi-Fi, the
simple `localhost` trick is not enough: phones only enable libre's security
features on an address that starts with `https://`. So you make a quick
"self-signed" certificate and start an HTTPS server. In the same folder as your
`index.html`, run:

```bash
# 1. create a one-week self-signed certificate (makes cert.pem + key.pem)
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 7 -nodes -subj "/CN=libre"

# 2. start an HTTPS server other devices on your Wi-Fi can reach
npx http-server . -S -C cert.pem -K key.pem -p 8099 -a 0.0.0.0
```

Then find your computer's local network address:

- **Mac:** run `ipconfig getifaddr en0` (it prints something like `192.168.0.42`).
- **Windows:** run `ipconfig` and read the **IPv4 Address** line.

On the phone (connected to the same Wi-Fi), open `https://<that-address>:8099`,
for example `https://192.168.0.42:8099`. The browser will warn that the
certificate is not trusted, because you created it yourself. That warning is
expected here: choose **Advanced** and continue to the site.

(`openssl` comes preinstalled on Mac and Linux. `npx` comes with `node`, a small
free program from [nodejs.org](https://nodejs.org/); install it once if the
command is not found.)

### For developers: rebuild from source

If you have the full project and `node` installed, regenerate the single file
yourself and serve it the same way:

```bash
./build.sh                                  # -> web/dist/index.html

# same computer:
python3 -m http.server 8099 --directory web/dist --bind 127.0.0.1
# then open http://127.0.0.1:8099

# phone / another device (HTTPS, from inside web/dist):
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 7 -nodes -subj "/CN=libre"
npx http-server web/dist -S -C cert.pem -K key.pem -p 8099 -a 0.0.0.0
```

`./build.sh` installs its build tools on first run and needs `node` and `npm`. The
resulting `web/dist/index.html` is the self-contained file you can hand to anyone
for the steps above. The generated `cert.pem` / `key.pem` are throwaway local
files and are already git-ignored, so they never get committed.

## 3. Run a relay

On a VPS **outside** the censoring jurisdiction:

```bash
cd relay
# 1. point a DNS A record at the VPS
# 2. set your hostname in Caddyfile and (optionally) info fields in strfry.conf
docker compose up -d
```

- `strfry` stores events; `Caddy` gives automatic HTTPS so clients get `wss://`.
- Verify: `wss://your-domain` should respond to a Nostr client.
- Add the URL in libre → **relays**, and publish it so others add it too.

Run relays in several jurisdictions with different operators. That diversity, not
any single relay, is the resilience.

### Vetting a relay before recommending it

Reachable is not enough. The client multiplexes every query over one WebSocket
connection per relay, so a relay that mishandles **concurrent subscriptions**
(answers only the first REQ, silently drops the rest) stalls every query in the
app to the full pool timeout, so it makes the whole client feel slow while looking
perfectly "up". Check all of it in one command:

```bash
node scripts/relay-check.mjs                      # check the current defaults
node scripts/relay-check.mjs wss://candidate.example   # vet a candidate
```

A relay must PASS all four columns (connect, EOSE, open writes, 12/12 concurrent
subs) before it goes into `DEFAULT_RELAYS` (`web/src/nostr/relays.js`). The
check publishes only an ephemeral-kind event, which relays acknowledge but never
store.

## 4. Native wrappers (optional)

- **PWA**: already configured (`manifest.webmanifest` + `sw.js`); users can
  "Add to Home Screen".
- **Android APK / F-Droid**: wrap the PWA (e.g. Trusted Web Activity / Capacitor)
  and distribute the APK directly and via F-Droid, not only Google Play.

## Notes

- The only build step is bundling `nostr-tools`; the output is committed so the app
  runs with zero npm at deploy time.
- Never add a runtime dependency on an external host (CDN, fonts, analytics). It
  becomes a chokepoint and breaks the static-files invariant (see `CLAUDE.md`).
