// Distribution build: produce dist/index.html - a single self-contained file
// (CSS, JS, and all i18n tables inlined) that runs from any static host or IPFS,
// and even directly from file://. The layered web/ source stays as-is for dev;
// this only bundles it for shipping. See CLAUDE.md §2 (distribution build).
//
// Runtime still makes ZERO third-party calls except relays and user-configured
// media hosts - everything the app needs is inlined here.

import esbuild from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

// CSP source expression for an inline <script>: hash its exact bytes so the
// single-file dist can lock script-src without 'unsafe-inline'. The hash must
// cover the script text only (no surrounding tag).
const cspHash = (text) => `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`;

const OUT_DIR = 'dist';

// 1. Bundle the whole app (incl. vendored nostr-tools) into one IIFE script.
const result = await esbuild.build({
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'iife',
  minify: true,
  target: ['es2022'],
  write: false,
});
let js = result.outputFiles[0].text;

// 1b. Optional extra minification pass with terser (opt-in via TERSER=1).
//     esbuild already minifies; terser squeezes a bit more off the shipped file.
//     Build-only tooling - no runtime dependency is added by this.
if (process.env.TERSER === '1') {
  let terser;
  try {
    ({ minify: terser } = await import('terser'));
  } catch {
    console.error('error: --terser requested but the terser package is missing; run npm install');
    process.exit(1);
  }
  const min = await terser(js, {
    ecma: 2022,
    compress: { passes: 2 },
    format: { comments: false },
  });
  js = min.code;
  console.log('terser pass applied');
}

// 2. Read the stylesheet and the locale tables to inline.
let css = readFileSync('styles/style.css', 'utf8');
// Inline the favicon as a data URI so the single file needs zero runtime fetch.
const favicon = `data:image/svg+xml,${encodeURIComponent(readFileSync('icon.svg', 'utf8'))}`;
// Inline the vendored JetBrains Mono woff2 files as base64 data URIs - the
// single-file dist ships no separate font assets, so relative url()s must
// become self-contained data: URIs.
for (const weight of ['Regular', 'Bold']) {
  const font = readFileSync(`vendor/fonts/JetBrainsMono-${weight}.woff2`).toString('base64');
  css = css.replace(
    `url("../vendor/fonts/JetBrainsMono-${weight}.woff2")`,
    `url("data:font/woff2;base64,${font}")`,
  );
}
const i18n = {
  en: JSON.parse(readFileSync('i18n/en.json', 'utf8')),
  ko: JSON.parse(readFileSync('i18n/ko.json', 'utf8')),
};

// 3. Compose a single HTML document. No external <link>/<script> references.
//    The two inline scripts are pinned by sha256 in the CSP so relay-delivered
//    content can't execute as script (XSS defence-in-depth). connect/img stay
//    broad: relays and media hosts are a user-editable, unbounded list, so the
//    real lock is on script/object/base. Mirrors web/index.html's dev CSP.
const i18nScript = `globalThis.__LIBRE_I18N=${JSON.stringify(i18n)};`;
const csp = [
  "default-src 'none'",
  `script-src ${cspHash(i18nScript)} ${cspHash(js)}`,
  "style-src 'unsafe-inline'",
  "font-src data:",
  'img-src https: data: blob:',
  'connect-src https: wss: ws:',
  "manifest-src 'self'",
  "worker-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<title>libre</title>
<meta name="description" content="Decentralized, censorship-resistant communities on Nostr.">
<link rel="icon" href="${favicon}">
<style>${css}</style>
</head>
<body>
<div id="app"><noscript>libre needs JavaScript to reach the relays.</noscript></div>
<script>${i18nScript}</script>
<script>${js}</script>
</body>
</html>
`;

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(`${OUT_DIR}/index.html`, html);

// 4. Copy optional assets so an HTTP host still gets PWA + favicon. The single
//    index.html works without them; these are enhancements when served over HTTP.
for (const f of ['manifest.webmanifest', 'sw.js', 'icon.svg']) {
  try {
    copyFileSync(f, `${OUT_DIR}/${f}`);
  } catch {
    /* asset optional */
  }
}

const kb = (html.length / 1024).toFixed(0);
console.log(`dist/index.html written (${kb} kB, self-contained)`);
