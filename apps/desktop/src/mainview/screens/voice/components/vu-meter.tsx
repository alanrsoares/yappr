import { useAudioAnalyser, type MeterReading } from "~/hooks";

const BAR_COUNT = 20;
const BARS = Array.from({ length: BAR_COUNT }, (_, i) => {
  const threshold = Math.pow(i / (BAR_COUNT - 1), 1.2);
  const tone: BarTone =
    i >= BAR_COUNT - 2 ? "red" : i >= BAR_COUNT - 5 ? "amber" : "green";
  return { threshold, tone, index: i };
});

type BarTone = "green" | "amber" | "red";

const TONE_CLASS: Record<BarTone, string> = {
  green: "bg-led-green",
  amber: "bg-led-amber",
  red: "bg-led-red",
};

const TONE_GLOW: Record<BarTone, string> = {
  green:
    "shadow-[0_0_6px_rgba(62,226,124,0.8),inset_0_0_2px_rgba(255,255,255,0.45)]",
  amber:
    "shadow-[0_0_6px_rgba(255,165,0,0.85),inset_0_0_2px_rgba(255,255,255,0.45)]",
  red: "shadow-[0_0_6px_rgba(255,56,56,0.9),inset_0_0_2px_rgba(255,255,255,0.45)]",
};

interface VuMeterPairProps {
  audio: HTMLAudioElement | null;
}

export function VuMeterPair({ audio }: VuMeterPairProps) {
  const readings = useAudioAnalyser(audio);
  return (
    <div
      className="
        flex flex-col gap-2
        bg-chassis-deep rounded-sm shadow-bezel-deep border border-black/80
        px-3 py-3
      "
      aria-hidden="true"
    >
      <Scale />
      <VuMeterBar reading={readings.left} channel="L" />
      <VuMeterBar reading={readings.right} channel="R" />
    </div>
  );
}

interface VuMeterBarProps {
  reading: MeterReading;
  channel: string;
}

function VuMeterBar({ reading, channel }: VuMeterBarProps) {
  const peakIndex =
    reading.peak > 0.02 ? Math.floor(reading.peak * BAR_COUNT) : -1;

  return (
    <div className="flex items-center gap-2.5">
      <span className="font-label font-medium text-[0.65rem] tracking-[0.3em] uppercase text-foil-mute w-3">
        {channel}
      </span>
      <div className="relative flex-1 flex items-center gap-[2px] h-5">
        {BARS.map(({ threshold, tone, index }) => {
          const lit = reading.level >= threshold;
          const isPeak = index === peakIndex;
          const above = (reading.level - threshold) / (1 - threshold);
          const intensity = lit ? Math.min(1, 0.6 + above * 1.5) : 0;
          return (
            <span
              key={index}
              className={`
                flex-1 h-full rounded-[1px] motion-reduce:transition-none
                ${TONE_CLASS[tone]}
                ${lit || isPeak ? TONE_GLOW[tone] : ""}
              `}
              style={{
                opacity: isPeak && !lit ? 0.95 : lit ? intensity : 0.07,
                transition: "opacity 70ms linear",
                willChange: "opacity",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

/** dB-ish scale ticks above the meters. */
function Scale() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-3" />
      <div className="flex-1 flex justify-between font-label text-[0.5rem] tracking-[0.2em] uppercase text-foil-dim">
        <span>-20</span>
        <span>-12</span>
        <span>-6</span>
        <span>-3</span>
        <span className="text-led-red/70">0</span>
      </div>
    </div>
  );
}
