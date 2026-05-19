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
