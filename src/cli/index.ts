import { KittenTTSClient } from "../sdk";
import { spawn } from "bun";
import path from "path";
import fs from "fs";
import { AudioRecorder } from "../sdk/recorder";
import { AudioManager } from "../sdk/audio_manager";
import { McpManager } from "../sdk/mcp";

const PROJECT_ROOT = path.resolve(__dirname, "../../");
const VENV_PYTHON = path.join(PROJECT_ROOT, "python/venv/bin/python");
const SERVER_SCRIPT = path.join(PROJECT_ROOT, "python/server.py");

async function startServer() {
  console.log("Starting Kitten TTS Server...");
  console.log(`Using Python: ${VENV_PYTHON}`);
  
  const proc = spawn([VENV_PYTHON, SERVER_SCRIPT], {
    cwd: PROJECT_ROOT,
    stdout: "inherit",
    stderr: "inherit",
  });

  await proc.exited;
}

async function speak(text: string, outputFile: string = "output.wav", options: { voice?: string, speed?: number } = {}) {
  const client = new KittenTTSClient();
  console.log(`Synthesizing: "${text}" using voice: ${options.voice || "default"}...`);
  
  try {
    const audioData = await client.synthesize(text, options);
    await Bun.write(outputFile, audioData);
    console.log(`Saved to ${outputFile}`);
    
    if (process.platform === "darwin") {
        spawn(["afplay", outputFile]);
    } else if (process.platform === "linux") {
        spawn(["aplay", outputFile]); 
    }
  } catch (error) {
    console.error("Failed. Is the server running? Run 'yappr serve' in another terminal.");
  }
}

async function listVoices() {
    const client = new KittenTTSClient();
    try {
        const voices = await client.listVoices();
        console.log("Available voices:");
        voices.forEach(v => console.log(`- ${v}`));
    } catch (e) {
        console.error("Failed to list voices. Is the server running?");
    }
}

async function ollamaChat(prompt: string, model: string = "qwen2.5:14b", voice: string = "af_bella", useTools: boolean = true) {
  const mcp = new McpManager();
  let tools: any[] = [];

  if (useTools) {
      await mcp.loadConfig();
      tools = mcp.getOllamaTools();
  }

  const messages = [{ role: "user", content: prompt }];

  try {
    while (true) {
        console.log(`Sending request to Ollama (${model})...`);
        
        const response = await fetch("http://localhost:11434/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model, 
                messages, 
                stream: false,
                tools: tools.length > 0 ? tools : undefined
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            
            if (errorText.includes("does not support tools") && useTools) {
                console.warn(`\n⚠️  Model '${model}' does not support tools. Disabling tools and retrying...\n`);
                await mcp.close();
                return ollamaChat(prompt, model, voice, false);
            }

            console.error(`Ollama Error Body: ${errorText}`);
            throw new Error(`Ollama error: ${response.statusText} - ${errorText}`);
        }

        const data = await response.json() as any;
        const message = data.message;
        
        messages.push(message);

        if (message.tool_calls && message.tool_calls.length > 0) {
            console.log("Model requested tool execution...");
            
            for (const call of message.tool_calls) {
                const toolName = call.function.name;
                const toolArgs = call.function.arguments;
                
                console.log(`Executing ${toolName} with`, toolArgs);
                
                try {
                    const result = await mcp.callTool(toolName, toolArgs);
                    
                    messages.push({
                        role: "tool",
                        content: JSON.stringify(result.content)
                    });
                } catch (err: any) {
                    console.error(`Tool execution failed: ${err.message}`);
                    messages.push({
                        role: "tool",
                        content: `Error: ${err.message}`
                    });
                }
            }
        } else {
            const responseText = message.content;
            console.log(`\nOllama: ${responseText}\n`);
            
            await mcp.close();
            return responseText;
        }
    }
  } catch (error) {
    console.error("Chat failed:", error);
    await mcp.close();
    throw error;
  }
}

async function runListen(args: string[]) {
    const client = new KittenTTSClient();
    const recorder = new AudioRecorder();
    const audioManager = new AudioManager();
    
    const devices = await audioManager.listDevices();
    if (devices.length === 0) {
        console.error("No audio input devices found!");
        process.exit(1);
    }

    let deviceIndex = 0;
    const deviceArgIdx = args.indexOf("--device");
    if (deviceArgIdx !== -1) {
        const val = args[deviceArgIdx + 1];
        if (val !== undefined) deviceIndex = parseInt(val, 10);
    } else {
        console.log("\nAvailable Audio Devices:");
        devices.forEach(d => console.log(`  [${d.index}] ${d.name}`));
        
        process.stdout.write(`\nSelect device [0-${devices.length-1}] (default 0): `);
        
        for await (const line of console) {
            const input = line.trim();
            if (input === "") {
                deviceIndex = 0;
            } else {
                const parsed = parseInt(input, 10);
                if (!isNaN(parsed) && devices.find(d => d.index === parsed)) {
                    deviceIndex = parsed;
                } else {
                    console.log("Invalid selection, defaulting to 0.");
                    deviceIndex = 0;
                }
            }
            break;
        }
    }
    
    const selectedDevice = devices.find(d => d.index === deviceIndex) || devices[0];
    if (!selectedDevice) {
        console.error("Critical: No audio device available.");
        process.exit(1);
    }
    console.log(`\nUsing: ${selectedDevice.name}`);

    let model = "qwen2.5:14b";
    let voice = "af_sky";

    const modelIdx = args.indexOf("--model");
    if (modelIdx !== -1) {
        const val = args[modelIdx + 1];
        if (val !== undefined) model = val;
    }

    const voiceIdx = args.indexOf("--voice");
    if (voiceIdx !== -1) {
        const val = args[voiceIdx + 1];
        if (val !== undefined) voice = val;
    }

    console.log(`\n🎧 Voice Mode Active (${model} | ${voice})`);
    console.log("-----------------------------------------");
    
    while (true) {
        try {
            await recorder.record("input.wav", deviceIndex);
            
            process.stdout.write("Transcribing... ");
            const text = await client.transcribe("input.wav");
            console.log(`\n👤 You: "${text}"`);
            
            if (!text || text.trim().length < 2) {
                console.log("(...no speech detected, trying again...)");
                continue;
            }

            const response = await ollamaChat(text, model, voice);
            
            if (response) {
                await speak(response, "output.wav", { voice });
            }

        } catch (error) {
            if (error instanceof Error && error.message.includes("interrupted")) {
                process.exit(0);
            }
            console.error("\nError in loop:", error);
            await new Promise(r => setTimeout(r, 1000));
        }
    }
}

async function runChat(args: string[]) {
    const promptIndex = args.findIndex(arg => !arg.startsWith("-") && arg !== "chat");
    const prompt = args[promptIndex];
    
    if (!prompt) {
        console.error("Usage: yappr chat <prompt> [--model <model>] [--voice <voice>]");
        process.exit(1);
    }

    let model = "qwen2.5:14b"; 
    let voice = "af_bella";

    const modelIdx = args.indexOf("--model");
    if (modelIdx !== -1) {
        const val = args[modelIdx + 1];
        if (val !== undefined) model = val;
    }

    const voiceIdx = args.indexOf("--voice");
    if (voiceIdx !== -1) {
        const val = args[voiceIdx + 1];
        if (val !== undefined) voice = val;
    }

    try {
        const responseText = await ollamaChat(prompt, model, voice);
        if (responseText) {
            await speak(responseText, "output.wav", { voice });
        }
    } catch (e) {
         // Handled inside
    }
}

async function runSpeak(args: string[]) {
    const textIndex = args.findIndex(arg => !arg.startsWith("-") && arg !== "speak");
    const text = args[textIndex];
    
    if (!text) {
        console.error("Usage: yappr speak <text> [--voice <voice>] [--speed <speed>]");
        process.exit(1);
    }

    let voice = "af_bella";
    let speed = 1.0;

    const voiceIdx = args.indexOf("--voice");
    if (voiceIdx !== -1) {
        const val = args[voiceIdx + 1];
        if (val !== undefined) voice = val;
    }

    const speedIdx = args.indexOf("--speed");
    if (speedIdx !== -1) {
        const val = args[speedIdx + 1];
        if (val !== undefined) speed = parseFloat(val);
    }

    await speak(text, "output.wav", { voice, speed });
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case "serve":
      await startServer();
      break;
    case "speak":
      await runSpeak(args);
      break;
    case "chat":
      await runChat(args);
      break;
    case "listen":
      await runListen(args);
      break;
    case "voices":
      await listVoices();
      break;
    default:
      console.log("Usage:");
      console.log("  yappr serve              Start the TTS server");
      console.log("  yappr speak <text>       Synthesize speech");
      console.log("  yappr chat <prompt>      Chat with Ollama via TTS");
      console.log("  yappr listen             Voice-to-voice chat");
      console.log("  yappr voices             List available voices");
      break;
  }
}

main();
