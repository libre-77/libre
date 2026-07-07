// Pure helpers: pull image URLs out of post text so the UI can render them as
// <img>. Strict patterns (http/https + known image extension, or our encrypted
// image fragment) so only safe, obvious image links are rendered - never
// arbitrary markup (CLAUDE.md §7).
//
// Encrypted images (see nostr/mediacrypt.js) carry their one-time key in the
// URL fragment: https://host/<sha256>#enc=v1.<key>.<iv>.<subtype>
// Browsers never send the fragment in HTTP requests, so the media server
// stores ciphertext it cannot decrypt; only readers of the post can.

const B64URL = '[A-Za-z0-9_-]+';
const ENC_SRC = `https?:\\/\\/[^\\s"'<>#]+#enc=v1\\.${B64URL}\\.${B64URL}\\.[a-z0-9]+`;
// `#` is excluded so a plain match can never swallow an encrypted fragment
// that happens to end in an image extension (e.g. `...#enc=v1.<k>.<iv>.png`).
const PLAIN_SRC = `https?:\\/\\/[^\\s"'<>#]+\\.(?:jpe?g|png|gif|webp|avif)(?:\\?[^\\s"'<>#]*)?`;
const IMG_RE = new RegExp(`${ENC_SRC}|${PLAIN_SRC}`, 'gi');
const ENC_PARSE_RE = new RegExp(`^(.+)#enc=v1\\.(${B64URL})\\.(${B64URL})\\.([a-z0-9]+)$`);

/** Return an array of image URLs (plain or encrypted) found in `text`. */
export function extractImageUrls(text) {
  return String(text).match(IMG_RE) || [];
}

/** True when `url` is an encrypted-image URL produced by libre. */
export function isEncryptedImageUrl(url) {
  return ENC_PARSE_RE.test(String(url));
}

/**
 * Split an encrypted-image URL into its parts, or null when it isn't one.
 * `key` and `iv` stay base64url-encoded; decoding is the crypto layer's job.
 */
export function parseEncryptedImageUrl(url) {
  const m = ENC_PARSE_RE.exec(String(url));
  if (!m) return null;
  return { base: m[1], key: m[2], iv: m[3], subtype: m[4] };
}
