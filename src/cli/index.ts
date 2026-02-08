/**
 * CLI Entry Point / Dispatcher
 * This allows running specific commands like 'speak', 'chat', etc.
 * directly from the command line without entering the full TUI.
 */
import { parseArgs } from "util";

import { chat, listVoices, speak } from "./services/yappr.js";

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
    case "serve":
      console.log("Starting inference server...");
      console.log(
        "Please use 'bun run start:py' to start the python inference server.",
      );
      break;
    case "voices":
      {
        const voices = await listVoices();
        voices.match(
          (v) => console.log(v.join("\n")),
          (e) => console.error("Error listing voices:", e.message),
        );
      }
      break;
    case "speak":
      {
        const text = positionals.slice(1).join(" ");
        if (!text) {
          console.error(
            'Usage: bun run speak "text to speak" [--voice af_sky] [--speed 1.0]',
          );
          return;
        }
        const speakRes = await speak(text, {
          voice: values.voice,
          speed: values.speed ? parseFloat(values.speed) : 1.0,
        });
        speakRes.match(
          () => {},
          (e) => console.error("Error:", e.message),
        );
      }
      break;
    case "chat":
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
        const chatRes = await chat(prompt, {
          model: values.model,
          onUpdate: (content) => {
            process.stdout.write(content.slice(lastLength));
            lastLength = content.length;
          },
        });
        console.log(""); // newline
        chatRes.match(
          () => {},
          (e) => console.error("Error:", e.message),
        );
      }
      break;
    default:
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

run();
