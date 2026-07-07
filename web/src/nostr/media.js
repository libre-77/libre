// Image upload via the Blossom protocol (BUD-02). Blobs are content-addressed by
// sha256, so the same file has the same URL on any server and can be mirrored -
// keeping media censorship-resistant like the rest of libre. Media servers are a
// user-editable list (the "user-configured media hosts" allowance, CLAUDE.md §2).

import { sign } from './signer.js';
import { encryptImage } from './mediacrypt.js';
import { storedList } from '../lib/storedList.js';
import { STORAGE_KEYS } from '../lib/storageKeys.js';
import { nowSeconds } from '../lib/time.js';

const KIND_BLOSSOM_AUTH = 24242; // BUD-02 authorization event

export const DEFAULT_MEDIA_SERVERS = [
  'https://blossom.band',
  'https://blossom.nostr.build',
];

const servers = storedList({
  key: STORAGE_KEYS.mediaServers,
  defaults: DEFAULT_MEDIA_SERVERS,
  pattern: /^https:\/\/.+/, // media uploads go over https only
});

export const getMediaServers = servers.get;
export const setMediaServers = servers.set;

/**
 * Encrypt an image with a fresh per-file key and upload the ciphertext to the
 * first working media server. Returns the blob URL with the key in its
 * fragment (see mediacrypt.js) - the server only ever stores noise it cannot
 * read. Content-addressed by the ciphertext hash, so the encrypted bytes can
 * still be mirrored to any other server under the same URL path.
 */
export async function uploadImage(rawFile) {
  const file = await stripExif(rawFile); // remove GPS/device metadata before upload
  const plain = new Uint8Array(await file.arrayBuffer());
  const { data, fragment } = await encryptImage(plain, file.type);
  const hash = await sha256hex(data);
  const auth = await buildAuth(hash);

  let lastError = null;
  for (const server of getMediaServers()) {
    try {
      const res = await fetch(`${server.replace(/\/$/, '')}/upload`, {
        method: 'PUT',
        headers: {
          // The ciphertext is wrapped in a 1x1 PNG shell (see mediacrypt.js)
          // because public Blossom servers sniff bytes and reject non-images.
          'Content-Type': 'image/png',
          'X-SHA-256': hash,
          Authorization: auth,
        },
        body: data,
      });
      if (!res.ok) {
        lastError = new Error(`upload ${res.status}`);
        continue;
      }
      const blob = await res.json();
      if (blob?.url) return blob.url + '#' + fragment;
      lastError = new Error('no url in descriptor');
    } catch (err) {
      lastError = err; // try the next server
    }
  }
  throw lastError || new Error('upload-failed');
}

// Re-encode raster images through a canvas so EXIF (GPS, device, timestamp) is
// dropped. Orientation is baked in first so the image still looks right. Formats
// a canvas can't encode (gif/svg) pass through unchanged - warn users about those.
async function stripExif(file) {
  if (!/^image\/(jpeg|png|webp|avif)$/.test(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext('2d').drawImage(bitmap, 0, 0);
    bitmap.close?.();
    const type = file.type === 'image/avif' ? 'image/webp' : file.type; // avif encode unsupported
    const blob = await new Promise((res) => canvas.toBlob(res, type, 0.92));
    if (!blob) return file;
    const ext = type.split('/')[1].replace('jpeg', 'jpg');
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.' + ext, { type });
  } catch {
    return file; // if re-encoding fails, don't block the user (upload original)
  }
}

async function buildAuth(hash) {
  const expiration = nowSeconds() + 300; // 5 min window
  const event = await sign({
    kind: KIND_BLOSSOM_AUTH,
    content: 'Upload image from libre',
    tags: [
      ['t', 'upload'],
      ['x', hash],
      ['expiration', String(expiration)],
    ],
  });
  return 'Nostr ' + btoa(JSON.stringify(event));
}

async function sha256hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
