/** Pure helpers for image attachment paths shared by CLI and desktop. */

export const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|bmp)$/i;

export const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
};

/**
 * Best-effort normalization for a path string sourced from terminal
 * drag-and-drop or clipboard text. Handles:
 *   - surrounding quotes (single, double, backtick)
 *   - backslash-escaped characters (Terminal-style "\ " for spaces)
 *   - `file://` URLs (URI-decoded)
 *   - leading/trailing whitespace
 */
export function normalizeImagePath(value: string): string {
  let s = value.trim();
  s = s.replace(/^['"`]+|['"`]+$/g, "");
  s = s.replace(/\\(.)/g, "$1");
  if (s.startsWith("file://")) {
    try {
      s = decodeURI(s.slice("file://".length));
    } catch {
      // leave as-is
    }
  }
  return s.trim();
}

export function looksLikeImagePath(value: string): boolean {
  return IMAGE_EXT_RE.test(normalizeImagePath(value));
}

/** Returns the image MIME type for a path by file extension, or `null`. */
export function imageMimeForPath(path: string): string | null {
  const dot = path.lastIndexOf(".");
  if (dot === -1) return null;
  return MIME_BY_EXT[path.slice(dot).toLowerCase()] ?? null;
}

/**
 * Inline placeholder tokens emitted into the composer when an image is
 * attached. Mirrors Claude Code's `[Image #N]` UX — N is 1-based and refers
 * to the position of the attachment in the pending list at the time of attach.
 */
export const IMAGE_TOKEN_RE = /\[Image #(\d+)\]/g;

export function formatImageToken(n: number): string {
  return `[Image #${n}]`;
}

/**
 * Parses inline image tokens out of `text` and returns the cleaned prompt
 * plus the attachments referenced by those tokens, in token order, deduped.
 * Tokens that reference indices outside `attachments` are silently dropped
 * from the resulting `images` list but still stripped from the prompt.
 */
export function parseImageTokens(
  text: string,
  attachments: readonly string[],
): { prompt: string; images: string[] } {
  const seen = new Set<number>();
  const images: string[] = [];
  for (const m of text.matchAll(IMAGE_TOKEN_RE)) {
    const captured = m[1];
    if (!captured) continue;
    const idx = Number.parseInt(captured, 10) - 1;
    const attachment = attachments[idx];
    if (attachment === undefined || seen.has(idx)) continue;
    seen.add(idx);
    images.push(attachment);
  }
  const prompt = text.replace(IMAGE_TOKEN_RE, "").replace(/\s+/g, " ").trim();
  return { prompt, images };
}

/**
 * Finds an image path inserted into `next` relative to `prev` (i.e. the diff
 * region) and returns its normalized path plus the slice indices in `next`,
 * so the caller can replace just that region with a token. Returns `null`
 * when the inserted region doesn't look like an image path.
 */
export function findInsertedImagePath(
  prev: string,
  next: string,
): { path: string; startIdx: number; endIdx: number } | null {
  if (next.length <= prev.length) return null;
  let p = 0;
  while (p < prev.length && p < next.length && prev[p] === next[p]) p++;
  let s = 0;
  while (
    s < prev.length - p &&
    s < next.length - p &&
    prev[prev.length - 1 - s] === next[next.length - 1 - s]
  ) {
    s++;
  }
  const inserted = next.slice(p, next.length - s);
  if (!inserted || !looksLikeImagePath(inserted)) return null;
  return {
    path: normalizeImagePath(inserted),
    startIdx: p,
    endIdx: next.length - s,
  };
}
