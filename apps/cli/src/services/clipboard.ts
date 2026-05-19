import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { access, writeFile } from "node:fs/promises";
import { homedir, platform, tmpdir } from "node:os";
import { join } from "node:path";
import { toError } from "@yappr/lib/result";
import { okAsync, ResultAsync } from "neverthrow";

const CACHE_DIR = join(homedir(), "Library", "Caches", "yappr", "paste");
const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|bmp)$/i;

function ensureCacheDir(): string {
  mkdirSync(CACHE_DIR, { recursive: true });
  return CACHE_DIR;
}

function readMacClipboardPng(): Buffer | null {
  const scratch = join(tmpdir(), `yappr-clip-${process.pid}.png`);
  const r = spawnSync(
    "osascript",
    [
      "-e",
      `set f to (open for access POSIX file "${scratch}" with write permission)`,
      "-e",
      "set eof f to 0",
      "-e",
      "write (the clipboard as «class PNGf») to f",
      "-e",
      "close access f",
    ],
    { encoding: "utf8" },
  );
  if (r.status !== 0) return null;
  try {
    const buf = readFileSync(scratch);
    return buf.length > 0 ? buf : null;
  } catch {
    return null;
  }
}

export function readClipboardImage(): ResultAsync<string | null, Error> {
  if (platform() !== "darwin") return okAsync(null);
  const buf = readMacClipboardPng();
  if (!buf) return okAsync(null);
  const dir = ensureCacheDir();
  const path = join(dir, `clip-${Date.now()}.png`);
  return ResultAsync.fromPromise(
    writeFile(path, new Uint8Array(buf)).then(() => path),
    toError,
  );
}

export function looksLikeImagePath(value: string): boolean {
  const trimmed = normalizeImagePath(value);
  return IMAGE_EXT_RE.test(trimmed);
}

export function normalizeImagePath(value: string): string {
  return value
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/\\ /g, " ");
}

export function imagePathExists(path: string): ResultAsync<boolean, Error> {
  return ResultAsync.fromPromise(
    access(path)
      .then(() => true)
      .catch(() => false),
    toError,
  );
}
