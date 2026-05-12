import { useEffect, useState } from "react";

const FFT_SIZE = 64;
const SMOOTHING = 0.4;
const PEAK_HOLD_MS = 1200;
const PEAK_DECAY_PER_MS = 0.0008;

export interface MeterReading {
  readonly level: number; // 0-1, smoothed RMS this frame
  readonly peak: number; // 0-1, recent peak with hold + slow decay
}

export interface StereoReadings {
  readonly left: MeterReading;
  readonly right: MeterReading;
}

export const ZERO_READINGS: StereoReadings = {
  left: { level: 0, peak: 0 },
  right: { level: 0, peak: 0 },
};

const computeRMS = (data: Uint8Array): number => {
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const v = (data[i] ?? 0) / 255;
    sum += v * v;
  }
  return Math.sqrt(sum / data.length);
};

/**
 * Tap an `HTMLAudioElement`'s stream and yield stereo RMS levels + peak-hold
 * readings at requestAnimationFrame cadence.
 *
 * Web Audio caveat: `createMediaElementSource` can be called at most once per
 * audio element. Pass a fresh element each playback (we do — each `speak()`
 * builds a new Audio).
 */
export function useAudioAnalyser(
  audio: HTMLAudioElement | null,
): StereoReadings {
  const [readings, setReadings] = useState<StereoReadings>(ZERO_READINGS);

  useEffect(() => {
    if (!audio) {
      setReadings(ZERO_READINGS);
      return;
    }

    let ctx: AudioContext;
    let source: MediaElementAudioSourceNode;
    try {
      ctx = new AudioContext();
      source = ctx.createMediaElementSource(audio);
    } catch {
      // Element already attached to another graph; bail without breaking playback.
      return;
    }

    const splitter = ctx.createChannelSplitter(2);
    const leftAnalyser = ctx.createAnalyser();
    const rightAnalyser = ctx.createAnalyser();
    leftAnalyser.fftSize = FFT_SIZE;
    rightAnalyser.fftSize = FFT_SIZE;
    leftAnalyser.smoothingTimeConstant = SMOOTHING;
    rightAnalyser.smoothingTimeConstant = SMOOTHING;

    source.connect(splitter);
    splitter.connect(leftAnalyser, 0);
    splitter.connect(rightAnalyser, 1);
    source.connect(ctx.destination);

    const leftBuf = new Uint8Array(leftAnalyser.frequencyBinCount);
    const rightBuf = new Uint8Array(rightAnalyser.frequencyBinCount);

    let raf = 0;
    let prevTime = 0;
    let peakL = 0;
    let peakR = 0;
    let peakLAt = 0;
    let peakRAt = 0;

    const tick = (time: number) => {
      const dt = prevTime === 0 ? 16 : time - prevTime;
      prevTime = time;

      leftAnalyser.getByteFrequencyData(leftBuf);
      rightAnalyser.getByteFrequencyData(rightBuf);
      const lL = computeRMS(leftBuf);
      const lR = computeRMS(rightBuf);

      if (lL > peakL) {
        peakL = lL;
        peakLAt = time;
      } else if (time - peakLAt > PEAK_HOLD_MS) {
        peakL = Math.max(0, peakL - PEAK_DECAY_PER_MS * dt);
      }

      if (lR > peakR) {
        peakR = lR;
        peakRAt = time;
      } else if (time - peakRAt > PEAK_HOLD_MS) {
        peakR = Math.max(0, peakR - PEAK_DECAY_PER_MS * dt);
      }

      setReadings({
        left: { level: lL, peak: peakL },
        right: { level: lR, peak: peakR },
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      void ctx.close();
    };
  }, [audio]);

  return readings;
}
