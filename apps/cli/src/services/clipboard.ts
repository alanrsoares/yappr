import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { access, writeFile } from "node:fs/promises";
import { homedir, platform, tmpdir } from "node:os";
import { join } from "node:path";
import { toError } from "@yappr/lib/result";
import { Effect } from "effect";

export {
  imageMimeForPath,
  looksLikeImagePath,
  normalizeImagePath,
} from "@yappr/lib/image-path";

const CACHE_DIR = join(homedir(), "Library", "Caches", "yappr", "paste");

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

export function readClipboardImage(): Effect.Effect<string | null, Error> {
  if (platform() !== "darwin") return Effect.succeed(null);
  const buf = readMacClipboardPng();
  if (!buf) return Effect.succeed(null);
  const dir = ensureCacheDir();
  const path = join(dir, `clip-${Date.now()}.png`);
  return Effect.tryPromise({
    try: () => writeFile(path, new Uint8Array(buf)).then(() => path),
    catch: toError,
  });
}

export function imagePathExists(path: string): Effect.Effect<boolean, Error> {
  return Effect.tryPromise({
    try: () =>
      access(path)
        .then(() => true)
        .catch(() => false),
    catch: toError,
  });
}
