import { useState, type ReactNode } from "react";

import { ArrowUp, Square } from "lucide-react";

import { cn } from "~/lib/utils";
import { Button } from "~/ui/button";
import {
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from "~/ui/prompt-input";

export type ComposerProps = {
  onSend: (text: string) => void;
  isBusy: boolean;
  onStop: () => void;
  leadingSlot?: ReactNode;
  disabled?: boolean;
  placeholder?: string;
};

/**
 * Wraps prompt-kit `PromptInput` with send/stop semantics (RecallOS-style).
 */
export function Composer({
  onSend,
  isBusy,
  onStop,
  leadingSlot,
  disabled,
  placeholder,
}: ComposerProps) {
  const [draft, setDraft] = useState("");

  const trimmedLength = draft.trim().length;
  const canSend = trimmedLength > 0 && !isBusy && !disabled;

  const submit = () => {
    if (!canSend) return;
    onSend(draft.trim());
    setDraft("");
  };

  return (
    <PromptInput
      value={draft}
      onValueChange={setDraft}
      onSubmit={submit}
      isLoading={isBusy}
      disabled={disabled}
      className="border-black/60 bg-chassis-deep p-0 shadow-bezel-deep"
    >
      <div className="flex flex-col">
        <PromptInputTextarea
          placeholder={placeholder ?? "Message Ollama…"}
          className="min-h-[52px] px-3 pt-3 pb-2 text-foil placeholder:text-foil-dim"
        />

        <PromptInputActions className="w-full justify-between gap-2 border-t border-black/50 px-2 py-2">
          <div className="flex min-w-0 items-center gap-2 text-[0.65rem] uppercase tracking-wider text-foil-mute">
            {leadingSlot}
          </div>

          <div className="flex items-center gap-2">
            <KbdHint disabled={!canSend && !isBusy}>↩</KbdHint>
            {isBusy ? (
              <PromptInputAction tooltip="Stop" side="top">
                <Button
                  type="button"
                  size="icon"
                  variant="destructive"
                  onClick={onStop}
                  aria-label="Stop generation"
                  className="size-8"
                >
                  <Square className="size-3.5" />
                </Button>
              </PromptInputAction>
            ) : (
              <PromptInputAction tooltip="Send · ↩" side="top">
                <Button
                  type="button"
                  size="icon"
                  variant="default"
                  onClick={submit}
                  disabled={!canSend}
                  aria-label="Send message"
                  className="size-8 border-led-amber/30 bg-button-raised text-led-amber hover:bg-panel-edge"
                >
                  <ArrowUp className="size-4" />
                </Button>
              </PromptInputAction>
            )}
          </div>
        </PromptInputActions>
      </div>
    </PromptInput>
  );
}

type KbdHintProps = {
  children: ReactNode;
  disabled?: boolean;
};

function KbdHint({ children, disabled }: KbdHintProps) {
  return (
    <kbd
      className={cn(
        "hidden select-none font-mono text-[11px] uppercase tracking-widest text-foil-dim sm:inline",
        disabled && "opacity-40",
      )}
    >
      {children}
    </kbd>
  );
}
