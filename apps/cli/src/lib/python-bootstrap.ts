import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { toError } from "@yappr/lib/result";
import { Effect } from "effect";

/** Find the yappr repo root by walking up from cwd until we hit `python/pyproject.toml`. */
export function findRepoRoot(startDir: string = process.cwd()): string | null {
  let dir = resolve(startDir);
  while (true) {
    if (existsSync(join(dir, "python", "pyproject.toml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export interface RunUvSyncOptions {
  repoRoot: string;
  /** Called for each stdout/stderr line as it arrives. */
  onLine: (line: string) => void;
  /** AbortController to cancel the running sync. */
  signal?: AbortSignal;
}

/** Run `uv sync --extra dev` inside `${repoRoot}/python`. Streams output via onLine. */
export function runUvSync(opts: RunUvSyncOptions): Effect.Effect<void, Error> {
  const cwd = join(opts.repoRoot, "python");
  return !existsSync(cwd)
    ? Effect.fail(new Error(`python directory not found at ${cwd}`))
    : Effect.tryPromise({
        try: () =>
          new Promise<void>((resolveP, rejectP) => {
            const child = spawn("uv", ["sync", "--extra", "dev"], {
              cwd,
              env: process.env,
              stdio: ["ignore", "pipe", "pipe"],
            });

            const pump = (chunk: Buffer) => {
              for (const line of chunk.toString().split(/\r?\n/)) {
                if (line.length > 0) opts.onLine(line);
              }
            };
            child.stdout.on("data", pump);
            child.stderr.on("data", pump);

            const onAbort = () => child.kill("SIGTERM");
            opts.signal?.addEventListener("abort", onAbort, { once: true });

            child.on("error", (err) => {
              opts.signal?.removeEventListener("abort", onAbort);
              rejectP(err);
            });
            child.on("close", (code) => {
              opts.signal?.removeEventListener("abort", onAbort);
              if (code === 0) resolveP();
              else rejectP(new Error(`uv sync exited with code ${code}`));
            });
          }),
        catch: toError,
      });
}

/** Quick check: does `${repoRoot}/python/.venv/bin/python` exist? */
export function pythonVenvExists(
  repoRoot: string,
): Effect.Effect<boolean, Error> {
  const venvPython = join(repoRoot, "python", ".venv", "bin", "python");
  return Effect.succeed(existsSync(venvPython));
}
