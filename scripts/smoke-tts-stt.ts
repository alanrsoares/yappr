#!/usr/bin/env bun
/**
 * End-to-end smoke test for the inference sidecar.
 *
 * 1. POST /synthesize with a known phrase   → WAV bytes
 * 2. POST /transcribe with those WAV bytes  → transcript
 * 3. Compare the transcript to the original via a token-based Jaccard ratio
 *    (lowercased, punctuation stripped). Pass when ratio ≥ --threshold.
 *
 * Usage:
 *   bun run scripts/smoke-tts-stt.ts                       # defaults
 *   bun run scripts/smoke-tts-stt.ts --text "Hello world"
 *   bun run scripts/smoke-tts-stt.ts --threshold 0.5       # looser
 *   bun run scripts/smoke-tts-stt.ts --backend kokoro      # advisory: warn if daemon serves another
 *
 * Exit code: 0 on pass, 1 on similarity fail, 2 on transport error.
 *
 * Kokoro is deterministic and scores high (~0.85+). Non-deterministic or
 * cloning backends score lower (~0.4-0.6); use `--threshold` to tune.
 */
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";

const DEFAULT_TEXT =
  "The quick brown fox jumps over the lazy dog near the river bank.";

interface Args {
  baseUrl: string;
  text: string;
  voice: string;
  threshold: number;
  backendHint: string | null;
  keepWav: boolean;
}

function parseCliArgs(): Args {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      "base-url": { type: "string", default: "http://localhost:8000" },
      text: { type: "string", default: DEFAULT_TEXT },
      voice: { type: "string", default: "af_aoede" },
      threshold: { type: "string", default: "0.7" },
      backend: { type: "string" },
      "keep-wav": { type: "boolean", default: false },
    },
  });
  return {
    baseUrl: (values["base-url"] as string).replace(/\/+$/, ""),
    text: values.text as string,
    voice: values.voice as string,
    threshold: Number(values.threshold),
    backendHint: (values.backend as string | undefined) ?? null,
    keepWav: values["keep-wav"] as boolean,
  };
}

interface HealthBody {
  tts: string;
  stt: string;
  tts_backend: string | null;
  stt_backend: string | null;
}

async function fetchHealth(baseUrl: string): Promise<HealthBody> {
  const res = await fetch(`${baseUrl}/health`);
  if (!res.ok) throw new Error(`/health → HTTP ${res.status}`);
  return (await res.json()) as HealthBody;
}

async function synthesize(
  baseUrl: string,
  text: string,
  voice: string,
): Promise<Uint8Array> {
  const res = await fetch(`${baseUrl}/synthesize`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text, voice, speed: 1.0 }),
  });
  if (!res.ok) {
    throw new Error(`/synthesize → HTTP ${res.status}: ${await res.text()}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

async function transcribe(baseUrl: string, wav: Uint8Array): Promise<string> {
  const form = new FormData();
  form.append("file", new Blob([wav], { type: "audio/wav" }), "smoke.wav");
  const res = await fetch(`${baseUrl}/transcribe`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    throw new Error(`/transcribe → HTTP ${res.status}: ${await res.text()}`);
  }
  const body = (await res.json()) as { text?: string };
  return body.text ?? "";
}

const tokenize = (input: string): Set<string> =>
  new Set(
    input
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter(Boolean),
  );

function jaccardSimilarity(a: string, b: string): number {
  const left = tokenize(a);
  const right = tokenize(b);
  if (left.size === 0 && right.size === 0) return 1;
  const intersection = new Set([...left].filter((tok) => right.has(tok)));
  const union = new Set([...left, ...right]);
  return intersection.size / union.size;
}

const format = (n: number): string => n.toFixed(3);

async function main(): Promise<void> {
  const args = parseCliArgs();

  console.log(`▶ probing ${args.baseUrl}/health…`);
  let health: HealthBody;
  try {
    health = await fetchHealth(args.baseUrl);
  } catch (err) {
    console.error(`✗ daemon unreachable: ${(err as Error).message}`);
    process.exit(2);
  }
  console.log(
    `  tts=${health.tts}(${health.tts_backend ?? "—"}) ` +
      `stt=${health.stt}(${health.stt_backend ?? "—"})`,
  );
  if (args.backendHint && args.backendHint !== health.tts_backend) {
    console.warn(
      `  ⚠ daemon serves '${health.tts_backend}', --backend hint was '${args.backendHint}'`,
    );
  }
  if (health.tts !== "ready") {
    console.error("✗ TTS unavailable");
    process.exit(2);
  }
  if (health.stt !== "ready") {
    console.error("✗ STT unavailable");
    process.exit(2);
  }

  console.log(
    `▶ TTS: synthesising ${args.text.length} chars (voice=${args.voice})…`,
  );
  const ttsStart = Date.now();
  let wav: Uint8Array;
  try {
    wav = await synthesize(args.baseUrl, args.text, args.voice);
  } catch (err) {
    console.error(`✗ ${(err as Error).message}`);
    process.exit(2);
  }
  const ttsMs = Date.now() - ttsStart;
  console.log(`  → ${wav.length} bytes in ${ttsMs}ms`);

  const wavPath = join(tmpdir(), `yappr-smoke-${Date.now()}.wav`);
  await writeFile(wavPath, wav);

  console.log("▶ STT: transcribing…");
  const sttStart = Date.now();
  let transcript: string;
  try {
    transcript = await transcribe(args.baseUrl, wav);
  } catch (err) {
    console.error(`✗ ${(err as Error).message}`);
    process.exit(2);
  }
  const sttMs = Date.now() - sttStart;
  console.log(`  → "${transcript}" in ${sttMs}ms`);

  const similarity = jaccardSimilarity(args.text, transcript);
  const pass = similarity >= args.threshold;
  console.log("");
  console.log(`original   : ${args.text}`);
  console.log(`transcript : ${transcript}`);
  console.log(
    `similarity : ${format(similarity)} (threshold ${format(args.threshold)})`,
  );
  console.log(`tts_backend: ${health.tts_backend ?? "—"}`);
  console.log(`stt_backend: ${health.stt_backend ?? "—"}`);
  console.log(`tts time   : ${ttsMs}ms`);
  console.log(`stt time   : ${sttMs}ms`);

  if (args.keepWav) {
    console.log(`wav kept at: ${wavPath}`);
  }

  if (!pass) {
    console.error(
      `\n✗ FAIL — similarity ${format(similarity)} < threshold ${format(args.threshold)}`,
    );
    process.exit(1);
  }
  console.log("\n✓ PASS");
}

void main();
