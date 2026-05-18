export interface WavConversion {
  readonly wav: Blob;
  readonly durationSec: number;
  readonly rms: number; // 0–1, root-mean-square energy of the decoded signal
}

/**
 * Convert an arbitrary recorded `Blob` (mp4/webm/ogg) into a 16-bit PCM WAV
 * Blob. Whisper / faster-whisper natively prefer WAV; piping mp4 through
 * ffmpeg in the server has been observed to produce single-word
 * hallucinations ("You", "Thank you") when the input is short or has weird
 * MOOV-atom placement. Converting in the webview avoids that path entirely.
 *
 * Returns the WAV plus duration + RMS so callers can short-circuit on silent
 * or near-empty captures before paying the server round-trip.
 */
export async function blobToWavBlob(blob: Blob): Promise<WavConversion> {
  const arrayBuffer = await blob.arrayBuffer();
  const ctx = new AudioContext();
  try {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const wav = encodeWavBlob(audioBuffer);
    return {
      wav,
      durationSec: audioBuffer.duration,
      rms: rmsEnergy(audioBuffer),
    };
  } finally {
    await ctx.close();
  }
}

/** Root-mean-square energy across all channels, in [0, 1]. */
function rmsEnergy(buffer: AudioBuffer): number {
  let sumSquares = 0;
  let count = 0;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (const datum of data) {
      const v = datum ?? 0;
      sumSquares += v * v;
      count++;
    }
  }
  return count > 0 ? Math.sqrt(sumSquares / count) : 0;
}

/** Encode an `AudioBuffer` as a 16-bit PCM WAV blob. */
function encodeWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numSamples = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const buf = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buf);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // bits per sample
  writeAscii(view, 36, "data");
  view.setUint32(40, dataSize, true);

  // Interleave channels + clamp to int16.
  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) channels.push(buffer.getChannelData(c));

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = clamp(channels[c]![i] ?? 0, -1, 1);
      view.setInt16(
        offset,
        sample < 0 ? sample * 0x80_00 : sample * 0x7f_ff,
        true,
      );
      offset += 2;
    }
  }

  return new Blob([buf], { type: "audio/wav" });
}

const writeAscii = (view: DataView, offset: number, s: string): void => {
  for (let i = 0; i < s.length; i++)
    view.setUint8(offset + i, s.codePointAt(i) ?? 0);
};

const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : Math.min(v, hi);
