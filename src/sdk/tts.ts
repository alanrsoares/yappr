export interface TTSOptions {
  voice?: string;
  speed?: number;
  sampleRate?: number;
}

interface VoicesResponse {
  voices: string[];
}

interface TranscribeResponse {
  text: string;
}

export class KittenTTSClient {
  private baseUrl: string;

  constructor(baseUrl: string = "http://localhost:8000") {
    this.baseUrl = baseUrl;
  }

  async listVoices(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/voices`);
      if (!response.ok) {
        throw new Error(`Failed to list voices: ${response.statusText}`);
      }
      const data = await response.json() as VoicesResponse;
      return data.voices;
    } catch (error) {
      console.error("Error listing voices:", error);
      throw error;
    }
  }

  async transcribe(filePath: string): Promise<string> {
      try {
          const file = Bun.file(filePath);
          const formData = new FormData();
          formData.append("file", file);

          const response = await fetch(`${this.baseUrl}/transcribe`, {
              method: "POST",
              body: formData,
          });

          if (!response.ok) {
              throw new Error(`Transcription failed: ${response.statusText}`);
          }

          const data = await response.json() as TranscribeResponse;
          return data.text;
      } catch (error) {
          console.error("Error transcribing audio:", error);
          throw error;
      }
  }

  async synthesize(text: string, options: TTSOptions = {}): Promise<ArrayBuffer> {
    try {
      const body = {
        text,
        voice: options.voice || "af_bella",
        speed: options.speed || 1.0,
        sample_rate: options.sampleRate || 24000,
      };

      const response = await fetch(`${this.baseUrl}/synthesize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to synthesize: ${response.status} - ${errorText}`);
      }

      return await response.arrayBuffer();
    } catch (error) {
      console.error("Error synthesizing speech:", error);
      throw error;
    }
  }
}