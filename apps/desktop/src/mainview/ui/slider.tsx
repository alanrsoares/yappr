"use client";

import * as SliderPrimitive from "@radix-ui/react-slider";
import * as React from "react";

import { cn } from "~/lib/utils";

type SliderProps = React.ComponentPropsWithoutRef<
  typeof SliderPrimitive.Root
> & {
  "aria-valuetext"?: string;
};

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderProps
>(({ className, ...props }, ref) => {
  // Radix forwards everything to Root, but `role="slider"` lives on Thumb.
  // Move thumb-only ARIA attrs to the Thumb where Lighthouse expects them.
  const thumbLabel = props["aria-label"];
  const thumbLabelledBy = props["aria-labelledby"];
  const thumbValueText = props["aria-valuetext"];
  const rootProps = { ...props };
  delete rootProps["aria-label"];
  delete rootProps["aria-labelledby"];
  delete rootProps["aria-valuetext"];

  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cn(
        "relative flex w-full touch-none select-none items-center",
        className,
      )}
      {...rootProps}
    >
      <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-primary/20">
        <SliderPrimitive.Range className="absolute h-full bg-primary" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-label={thumbLabel}
        aria-labelledby={thumbLabelledBy}
        aria-valuetext={thumbValueText}
        className="block h-4 w-4 rounded-full border border-primary/50 bg-background shadow-sm transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
      />
    </SliderPrimitive.Root>
  );
});
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
