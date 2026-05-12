import tw from "@styled-cva/react";

export const Shell = tw.div`min-h-screen bg-zinc-950 text-zinc-100`;

export const Container = tw.div`container mx-auto px-6 py-10 max-w-xl`;

export const Title = tw.h1`text-3xl font-semibold mb-1`;

export const Subtitle = tw.p`text-sm text-zinc-400 mb-8`;

export const Card = tw.div`bg-zinc-900 rounded-lg p-6 mb-6 border border-zinc-800`;

export const Label = tw.label`block text-sm font-medium text-zinc-300 mb-2`;

export const Input = tw.input`w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-md text-zinc-100 font-mono text-sm focus:outline-none focus:border-zinc-600`;

export const ControlRow = tw.div`flex items-center gap-3 mt-4`;

export const Button = tw.button.cva(
  "px-4 py-2 font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
  {
    variants: {
      $variant: {
        primary: "bg-zinc-100 text-zinc-900 hover:bg-white",
        ghost: "bg-zinc-800 text-zinc-100 hover:bg-zinc-700",
      },
    },
    defaultVariants: {
      $variant: "primary",
    },
  },
);

export const StatusBadge = tw.span.cva("text-xs", {
  variants: {
    $state: {
      idle: "text-zinc-500",
      checking: "text-zinc-400",
      ok: "text-green-400",
      fail: "text-red-400",
    },
  },
  defaultVariants: {
    $state: "idle",
  },
});

export const Hint = tw.div`text-xs text-zinc-500 leading-relaxed space-y-2`;

export const InlineCode = tw.code`bg-zinc-900 px-1.5 py-0.5 rounded text-zinc-300`;
