import { parseArgs } from "node:util";
import { Effect } from "effect";

import { loadPreferences } from "./lib/preferences.js";
import { chat, listVoices, speak } from "./services/yappr";

const errorMessage = (e: unknown): string =>
  e instanceof Error ? e.message : String(e);

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    voice: { type: "string", short: "v" },
    speed: { type: "string", short: "s" },
    model: { type: "string", short: "m" },
    help: { type: "boolean", short: "h" },
  },
  allowPositionals: true,
});

const command = positionals[0];

async function run() {
  switch (command) {
    case "serve": {
      console.log("Starting inference server...");
      console.log(
        "Please use 'bun run start:py' to start the python inference server.",
      );
      break;
    }
    case "voices": {
      await Effect.runPromise(listVoices()).then(
        (v) => console.log(v.join("\n")),
        (e: unknown) => console.error("Error listing voices:", errorMessage(e)),
      );
      break;
    }
    case "speak": {
      {
        const text = positionals.slice(1).join(" ");
        if (!text) {
          console.error(
            'Usage: bun run speak "text to speak" [--voice af_sky] [--speed 1.0]',
          );
          return;
        }
        const prefs = await Effect.runPromise(loadPreferences()).catch(
          () => null,
        );
        await Effect.runPromise(
          speak(text, {
            voice: values.voice,
            speed: values.speed ? Number.parseFloat(values.speed) : 1,
            ...(prefs?.voiceReference
              ? { reference: prefs.voiceReference }
              : {}),
          }),
        ).catch((e: unknown) => console.error("Error:", errorMessage(e)));
      }
      break;
    }
    case "chat": {
      {
        const prompt = positionals.slice(1).join(" ");
        if (!prompt) {
          console.error(
            'Usage: bun run chat "your prompt" [--model qwen2.5:14b]',
          );
          return;
        }
        console.log(`Asking ${values.model || "default model"}...`);
        let lastLength = 0;
        await Effect.runPromise(
          chat(prompt, {
            model: values.model,
            onUpdate: (content) => {
              process.stdout.write(content.slice(lastLength));
              lastLength = content.length;
            },
          }),
        ).catch((e: unknown) => console.error("Error:", errorMessage(e)));
        console.log(""); // newline
      }
      break;
    }
    default: {
      console.log(`
Yappr CLI

Usage:
  bun run tui           Start the interactive TUI (Recommended)
  bun run start:py      Start the inference server
  bun run speak "text"  Synthesize text to speech
  bun run chat "query"  Chat with local LLM
  bun run voices        List available TTS voices
      `);
      break;
    }
  }
}

run();
