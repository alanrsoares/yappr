import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import { Pause, Play, RotateCcw, Square } from "lucide-react";

import {
  CAPTION_FONT_FAMILY,
  CAPTION_FONT_SIZE,
  CAPTION_FONT_WEIGHT,
  CAPTION_LINE_HEIGHT,
  layoutCaption,
  prepareCaption,
} from "~/lib/captions";
import { cn } from "~/lib/utils";
import type { VoiceCaptionState } from "~/stores/voice";
import { Button } from "~/ui/button";

interface KaraokeCaptionsProps {
  caption: VoiceCaptionState;
  bottomOffset: number;
  onPause: () => void;
  onResume: () => void;
  onRestart: () => void;
  onStop: () => void;
}

const captionTextStyle = {
  fontFamily: CAPTION_FONT_FAMILY,
  fontSize: `${CAPTION_FONT_SIZE}px`,
  fontWeight: CAPTION_FONT_WEIGHT,
  lineHeight: `${CAPTION_LINE_HEIGHT}px`,
} satisfies CSSProperties;

export function KaraokeCaptions({
  caption,
  bottomOffset,
  onPause,
  onResume,
  onRestart,
  onStop,
}: KaraokeCaptionsProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  const [fontsReady, setFontsReady] = useState(
    () =>
      typeof document === "undefined" ||
      !("fonts" in document) ||
      document.fonts.status === "loaded",
  );
  const active = caption.kind === "active" ? caption : null;
  const activeText = active?.text ?? "";
  const activeProgress = active?.progress ?? 0;
  const activeKey = active ? `${active.messageId ?? ""}:${active.text}` : "";

  useEffect(() => {
    if (
      typeof document === "undefined" ||
      !("fonts" in document) ||
      document.fonts.status === "loaded"
    )
      return;
    let cancelled = false;
    void document.fonts.ready.then(() => {
      if (!cancelled) setFontsReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const node = panelRef.current;
    if (!node || !activeKey) return;
    const update = () => setWidth(node.getBoundingClientRect().width);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [activeKey]);

  const prepared = useMemo(
    () => (activeText && fontsReady ? prepareCaption(activeText) : null),
    [activeText, fontsReady],
  );
  const layout = useMemo(() => {
    if (!prepared || width <= 0) return null;
    return layoutCaption(prepared, Math.max(1, width - 32), activeProgress);
  }, [activeProgress, prepared, width]);

  if (!active) return null;

  const activeIndex = layout?.activeLineIndex ?? -1;
  const previousLine =
    activeIndex > 0 ? layout?.lines[activeIndex - 1]?.text : null;
  const currentLine =
    activeIndex >= 0
      ? (layout?.lines[activeIndex]?.text ?? prepared?.text ?? active.text)
      : (prepared?.text ?? active.text);
  const nextLine =
    activeIndex >= 0 ? layout?.lines[activeIndex + 1]?.text : null;
  const progress = Math.min(1, Math.max(0, active.progress));
  const progressNow = Math.round(progress * 100);
  const hasTrack = active.duration > 0;
  const statusLabel = hasTrack
    ? active.paused
      ? "Paused"
      : "Speaking"
    : "Preparing Narration";

  return (
    <div
      className="pointer-events-none absolute inset-x-0 flex justify-center px-4"
      style={{
        bottom: `calc(${bottomOffset}px + env(safe-area-inset-bottom))`,
      }}
    >
      <div
        ref={panelRef}
        role="status"
        aria-live="polite"
        className="pointer-events-auto w-full max-w-2xl overflow-hidden rounded-xl border border-border/80 bg-background/90 p-3 shadow-2xl backdrop-blur"
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span
              className="size-2 rounded-full bg-accent shadow-[0_0_8px_hsl(var(--accent)/0.65)]"
              aria-hidden="true"
            />
            <span className="font-mono text-[0.65rem] uppercase tracking-widest text-muted-foreground">
              {statusLabel}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {hasTrack ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={active.paused ? onResume : onPause}
                  aria-label={
                    active.paused ? "Resume speaking" : "Pause speaking"
                  }
                  className="h-7 gap-1.5 rounded-full px-2 font-mono text-[0.65rem] uppercase tracking-widest"
                >
                  {active.paused ? (
                    <Play className="size-3" aria-hidden="true" />
                  ) : (
                    <Pause className="size-3" aria-hidden="true" />
                  )}
                  {active.paused ? "Play" : "Pause"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onRestart}
                  aria-label="Restart speaking"
                  className="size-7 rounded-full"
                >
                  <RotateCcw className="size-3" aria-hidden="true" />
                </Button>
              </>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onStop}
              aria-label={hasTrack ? "Stop speaking" : "Cancel narration"}
              className="h-7 gap-1.5 rounded-full px-2 font-mono text-[0.65rem] uppercase tracking-widest"
            >
              <Square className="size-3" aria-hidden="true" />
              {hasTrack ? "Stop" : "Cancel"}
            </Button>
          </div>
        </div>

        <div
          className={cn(
            "flex min-h-24 flex-col justify-center gap-1 text-center",
            !hasTrack &&
              "rounded-lg border border-border/50 bg-muted/20 px-3 py-2",
          )}
          style={captionTextStyle}
        >
          {!hasTrack ? (
            <>
              <p className="font-mono text-[0.65rem] leading-5 font-normal tracking-widest text-muted-foreground uppercase">
                Warming local voice engine…
              </p>
              <CaptionLine className="lcd-text text-balance text-xl opacity-70">
                {currentLine}
              </CaptionLine>
            </>
          ) : (
            <>
              {previousLine ? (
                <CaptionLine className="text-muted-foreground/55">
                  {previousLine}
                </CaptionLine>
              ) : null}
              <CaptionLine className="lcd-text text-balance text-xl">
                {currentLine}
              </CaptionLine>
              {nextLine ? (
                <CaptionLine className="text-muted-foreground/65">
                  {nextLine}
                </CaptionLine>
              ) : null}
            </>
          )}
        </div>

        <div
          className={cn(
            "mt-3 h-1 overflow-hidden rounded-full bg-muted",
            !hasTrack && "bg-muted/70",
          )}
          role="progressbar"
          aria-label={hasTrack ? "Speech progress" : "Narration loading"}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={hasTrack ? progressNow : undefined}
          aria-busy={!hasTrack}
        >
          <div
            className={cn(
              "h-full origin-left rounded-full bg-accent transition-transform duration-200 motion-reduce:transition-none",
              !hasTrack &&
                "bg-gradient-to-r from-accent/25 via-accent to-accent/25 motion-safe:animate-pulse",
            )}
            style={{
              transform: hasTrack ? `scaleX(${progress})` : "scaleX(1)",
            }}
          />
        </div>
      </div>
    </div>
  );
}

function CaptionLine({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <p className={cn("min-h-7 break-words whitespace-pre-wrap", className)}>
      {children || " "}
    </p>
  );
}
