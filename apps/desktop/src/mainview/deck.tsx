import tw from "@styled-cva/react";

/* ────────────────────────────────────────────────────────────
   CHASSIS + DECK
   ──────────────────────────────────────────────────────────── */

export const Chassis = tw.main`@container/app relative min-h-screen bg-chassis-grain px-4 py-5 @md/app:px-6 @md/app:py-6 brushed`;

export const Deck = tw.div`@container/deck relative w-full max-w-3xl rounded-md bg-panel bg-panel-strip shadow-chassis overflow-hidden`;

/* ────────────────────────────────────────────────────────────
   SERIAL PLATE — top bar with foil-stamped brand + model + LEDs
   ──────────────────────────────────────────────────────────── */

/* SerialPlate doubles as the window's draggable title bar. Inner controls
   (LEDs, future buttons) must opt out via `electrobun-no-drag`. The pl-20
   keeps the brand clear of the macOS traffic-light cluster (~72px wide). */
export const SerialPlate = tw.header`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pl-20 pr-5 py-3 border-b border-black/60 shadow-bezel [-webkit-app-region:drag] select-none`;

/** Apply to interactive children inside SerialPlate so they remain clickable. */
export const NoDrag = tw.div`[-webkit-app-region:no-drag]`;

export const Brand = tw.h1`font-label font-light text-[1.6rem] tracking-[0.32em] uppercase text-foil engraved leading-none`;

export const SerialNumber = tw.span`font-label font-light text-[0.55rem] tracking-[0.3em] uppercase text-foil-dim ml-3 engraved`;

/* ────────────────────────────────────────────────────────────
   BAY — asymmetric main zone
   ──────────────────────────────────────────────────────────── */

export const Bay = tw.section`grid grid-cols-1 gap-4 border-b border-black/50 px-4 py-4 shadow-bezel @md/deck:grid-cols-[1.1fr_1fr] @md/deck:gap-5 @md/deck:px-5 @md/deck:py-5`;

export const BayCol = tw.div`flex min-w-0 flex-col gap-4`;

/* ────────────────────────────────────────────────────────────
   TAPE WINDOW + REEL
   ──────────────────────────────────────────────────────────── */

export const TapeWindow = tw.div`relative flex h-[132px] flex-col items-center justify-around gap-2 rounded-sm border border-black/80 bg-chassis-deep p-3 shadow-bezel-deep @sm/deck:h-[148px] @sm/deck:flex-row @md/deck:h-[160px] @md/deck:p-4`;

export const TapeLabel = tw.span`absolute top-1.5 left-2 font-label font-light text-[0.5rem] tracking-[0.3em] uppercase text-foil-dim engraved`;

export const Reel = tw.div.cva(
  "relative h-[88px] w-[88px] motion-reduce:!animate-none @sm/deck:h-[100px] @sm/deck:w-[100px] @md/deck:h-[110px] @md/deck:w-[110px]",
  {
    variants: {
      $active: {
        true: "animate-reel-spin",
        false: "",
      },
    },
    defaultVariants: { $active: false },
  },
);

/* ────────────────────────────────────────────────────────────
   PITCH FADER section
   ──────────────────────────────────────────────────────────── */

export const PitchSection = tw.div`flex flex-col gap-2`;

export const PitchHeader = tw.div`flex items-baseline justify-between`;

export const PitchTitle = tw.span`font-label font-light text-[0.55rem] tracking-[0.4em] uppercase text-foil-mute engraved`;

export const PitchValue = tw.span`font-lcd text-lg text-led-amber lcd-text tabular-nums`;

export const PitchScale = tw.div`flex justify-between font-label text-[0.5rem] tracking-[0.3em] uppercase text-foil-dim px-1`;

/* ────────────────────────────────────────────────────────────
   TRANSPORT
   ──────────────────────────────────────────────────────────── */

export const TransportBay = tw.div`flex flex-col items-center gap-3 bg-chassis-deep rounded-sm shadow-bezel-deep border border-black/80 px-4 py-4`;

/** Big circular tactile PLAY knob. */
export const PlayKnob = tw.button.cva(
  "relative w-[68px] h-[68px] rounded-full font-label text-xl font-medium leading-none flex items-center justify-center select-none transition-[transform,box-shadow,filter] duration-150 active:translate-y-[1px] motion-reduce:active:translate-y-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:translate-y-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-led-amber focus-visible:ring-offset-2 focus-visible:ring-offset-chassis-deep",
  {
    variants: {
      $variant: {
        idle: "bg-button-raised text-foil shadow-button hover:brightness-110 border border-black/60",
        armed:
          "bg-button-raised text-led-amber shadow-[0_0_12px_rgba(255,165,0,0.55),inset_0_1px_0_rgba(255,255,255,0.1),inset_0_-2px_0_rgba(0,0,0,0.6),0_2px_4px_rgba(0,0,0,0.5)] border border-led-amber/40",
      },
    },
    defaultVariants: { $variant: "idle" },
  },
);

export const SecondaryRow = tw.div`flex gap-2 w-full`;

export const SecondaryButton = tw.button.cva(
  "flex-1 px-3 py-2 rounded-sm font-label font-medium tracking-[0.25em] uppercase text-[0.7rem] border transition-[transform,box-shadow,color,background-color,border-color] duration-150 active:translate-y-[1px] motion-reduce:active:translate-y-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:translate-y-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-led-amber focus-visible:ring-offset-1 focus-visible:ring-offset-chassis-deep",
  {
    variants: {
      $variant: {
        default:
          "bg-transparent text-foil-mute border-foil-dim/40 hover:text-foil hover:border-foil-dim/60",
        danger:
          "bg-transparent text-led-red/80 border-foil-dim/40 hover:text-led-red hover:border-led-red/40",
      },
    },
    defaultVariants: { $variant: "default" },
  },
);

/* ────────────────────────────────────────────────────────────
   LCD STRIP — Voice + Source row
   ──────────────────────────────────────────────────────────── */

export const StripRow = tw.div`grid grid-cols-1 gap-px border-b border-black/60 bg-black/70 shadow-bezel @md/deck:grid-cols-[1fr_1.4fr]`;

export const Slot = tw.div`flex flex-col gap-2 bg-panel px-3 py-2.5 @md/deck:flex-row @md/deck:items-baseline @md/deck:gap-3 @md/deck:px-4 @md/deck:py-2.5`;

export const SlotLabel = tw.label`font-label font-light text-[0.55rem] tracking-[0.4em] uppercase text-foil-mute engraved shrink-0 w-14 cursor-default`;

export const SlotValue = tw.div`flex-1 min-w-0`;

/* ────────────────────────────────────────────────────────────
   SCRIPT — terminal-style textarea
   ──────────────────────────────────────────────────────────── */

export const ScriptBay = tw.div`flex items-start gap-2 px-4 py-4 @md/deck:px-5`;

export const Prompt = tw.span`font-mono text-led-amber/80 text-sm pt-2 select-none`;

/* ────────────────────────────────────────────────────────────
   LCD READOUT — amber-on-black VT323 (still used for status)
   ──────────────────────────────────────────────────────────── */

export const LcdFrame = tw.div`bg-lcd rounded-sm shadow-bezel-deep border border-black/80 px-3 py-1.5`;

export const Lcd = tw.div.cva(
  "font-lcd text-lg leading-none tracking-wide select-none truncate",
  {
    variants: {
      $state: {
        on: "lcd-text",
        dim: "lcd-text-dim",
      },
    },
    defaultVariants: { $state: "on" },
  },
);

/* ────────────────────────────────────────────────────────────
   LED — small glowing dot
   ──────────────────────────────────────────────────────────── */

export const Led = tw.span.cva(
  "inline-block w-2 h-2 rounded-full transition-shadow",
  {
    variants: {
      $state: {
        off: "bg-black shadow-led-off",
        amber: "bg-led-amber shadow-led-amber",
        "amber-soft": "bg-led-amber-soft shadow-led-off",
        red: "bg-led-red shadow-led-red animate-pulse-led motion-reduce:animate-none",
        "red-soft": "bg-led-red-soft shadow-led-off",
        green: "bg-led-green shadow-led-green",
        "green-soft": "bg-led-green-soft shadow-led-off",
      },
    },
    defaultVariants: { $state: "off" },
  },
);

/* ────────────────────────────────────────────────────────────
   INPUTS (used inline in LCD slots and script bay)
   ──────────────────────────────────────────────────────────── */

const INPUT_BASE =
  "w-full px-2.5 py-1.5 bg-chassis-deep text-foil font-mono text-sm rounded-sm shadow-bezel-deep border border-black/70 focus-visible:outline-none focus-visible:border-led-amber/50 focus-visible:shadow-[inset_0_2px_6px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,165,0,0.25)] placeholder:text-foil-dim";

export const Input = tw.input.cva(INPUT_BASE, { variants: {} });

export const Textarea = tw.textarea.cva(
  "w-full px-2 py-1.5 bg-transparent text-foil font-mono text-sm focus-visible:outline-none placeholder:text-foil-dim resize-none leading-relaxed min-h-[80px]",
  { variants: {} },
);

/* ────────────────────────────────────────────────────────────
   FOOTNOTE (compact)
   ──────────────────────────────────────────────────────────── */

export const Footnote = tw.p`border-t border-black/50 px-4 py-2 font-mono text-[0.6rem] leading-relaxed text-foil-dim @md/deck:px-5 @md/deck:text-[0.65rem]`;

export const InlineCode = tw.code`bg-chassis-deep text-foil-mute px-1 py-0.5 rounded-sm border border-black/60 text-[0.6rem]`;
