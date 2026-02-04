import { spawn } from "bun";

export class AudioRecorder {
    async record(outputPath: string, deviceIndex: number = 0): Promise<void> {
        console.log(`🎤 Recording (Device :${deviceIndex})... Press ENTER to send.`);
        
        // Start recording with ffmpeg
        // -y: Overwrite output
        // -f avfoundation: Input format
        // -i ":<index>": Audio device index (video index omitted with empty string before :)
        // -ar 16000: 16kHz
        // -ac 1: Mono
        const proc = spawn(["ffmpeg", "-y", "-f", "avfoundation", "-i", `:${deviceIndex}`, "-ar", "16000", "-ac", "1", outputPath], {
            stdout: "ignore",
            stderr: "ignore", // ffmpeg is noisy
        });

        // Wait for ENTER
        // Using standard process.stdin iterator for Bun
        for await (const _ of console) {
            break; // Break after first line (Enter)
        }
        
        // Stop recording
        // ffmpeg needs 'q' usually, but SIGTERM/kill works for capturing
        proc.kill(); 
        await proc.exited;
        
        console.log("Processing...");
    }
}
