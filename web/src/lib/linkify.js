// Pure helper: split text into plain-text and URL segments so the UI can
// render bare links as <a> without ever using innerHTML (CLAUDE.md §7). Only
// http/https URLs match; everything else stays literal text. No scheme other
// than http(s) can appear, so javascript:/data: links are impossible.

const URL_RE = /https?:\/\/[^\s"'<>]+/gi;
// Trailing punctuation that is almost never part of a URL (sentence endings,
// closing brackets). Moved back into the following text segment.
const TRAIL_RE = /[.,;:!?)\]]+$/;

/**
 * Split `text` into ordered segments. Each is `{ url }` for a link or
 * `{ text }` for literal text. Concatenating the values reproduces `text`.
 */
export function linkifySegments(text) {
  const src = String(text);
  const segments = [];
  let last = 0;
  for (const m of src.matchAll(URL_RE)) {
    let url = m[0];
    const trail = url.match(TRAIL_RE);
    const tail = trail ? trail[0] : '';
    if (tail) url = url.slice(0, -tail.length);
    if (m.index > last) segments.push({ text: src.slice(last, m.index) });
    segments.push({ url });
    if (tail) segments.push({ text: tail });
    last = m.index + m[0].length;
  }
  if (last < src.length) segments.push({ text: src.slice(last) });
  return segments;
}
