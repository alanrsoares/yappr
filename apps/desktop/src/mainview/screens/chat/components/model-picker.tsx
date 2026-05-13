import { useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, RefreshCcw } from "lucide-react";

import { ollamaModelsOptions } from "~/lib/queries";
import { cn } from "~/lib/utils";
import { formatModelSize } from "~/services/ollama";
import { Button } from "~/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "~/ui/popover";

interface ModelPickerProps {
  value: string;
  onChange: (next: string) => void;
}

/**
 * Searchable model picker backed by Ollama `/api/tags` via TanStack Query.
 * Loading/error/refetch state is owned by the query cache — no bespoke
 * LoadState union here.
 */
export function ModelPicker({ value, onChange }: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const { data, error, isPending, isError, isFetching, refetch } =
    useQuery(ollamaModelsOptions);

  const models = data ?? [];
  const current = models.find((m) => m.name === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Pick model"
          className="h-8 w-[220px] justify-between gap-2 font-mono text-xs"
        >
          <span className="truncate text-left">{value || "Select model…"}</span>
          <ChevronsUpDown
            className="size-3.5 opacity-50 shrink-0"
            aria-hidden="true"
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[340px] p-0" translate="no">
        <Command>
          <CommandInput
            placeholder="Search models…"
            className="font-mono text-sm"
          />
          <CommandList>
            {isPending ? (
              <div className="px-3 py-6 text-center font-mono text-xs text-muted-foreground">
                Loading models…
              </div>
            ) : isError ? (
              <FailState
                reason={
                  error instanceof Error ? error.message : "Unknown error"
                }
                onRetry={() => void refetch()}
              />
            ) : models.length === 0 ? (
              <CommandEmpty>
                <div className="px-3 py-4 text-center font-mono text-xs text-muted-foreground">
                  No models installed. Run{" "}
                  <code className="text-foreground">ollama pull …</code> first.
                </div>
              </CommandEmpty>
            ) : (
              <>
                <CommandEmpty className="px-3 py-4 text-center font-mono text-xs text-muted-foreground">
                  No match.
                </CommandEmpty>
                <CommandGroup heading="Installed">
                  {models.map((m) => (
                    <CommandItem
                      key={m.name}
                      value={m.name}
                      onSelect={(v) => {
                        onChange(v);
                        setOpen(false);
                      }}
                      className="flex items-center justify-between gap-2 font-mono"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <Check
                          className={cn(
                            "size-3.5 shrink-0",
                            m.name === value
                              ? "opacity-100 text-led-amber"
                              : "opacity-0",
                          )}
                          aria-hidden="true"
                        />
                        <span className="truncate text-sm">{m.name}</span>
                      </span>
                      <span className="shrink-0 text-[0.65rem] text-muted-foreground">
                        {m.details?.parameter_size ?? formatModelSize(m.size)}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}

            {!isPending && !isError ? (
              <div className="border-t border-border px-2 py-1.5">
                <button
                  type="button"
                  onClick={() => void refetch()}
                  disabled={isFetching}
                  className="flex w-full items-center justify-between rounded-sm px-2 py-1 font-mono text-[0.65rem] uppercase tracking-widest text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  <span className="flex items-center gap-1.5">
                    <RefreshCcw
                      className={cn(
                        "size-3",
                        isFetching && "animate-spin motion-reduce:animate-none",
                      )}
                      aria-hidden="true"
                    />
                    {isFetching ? "Refreshing…" : "Refresh"}
                  </span>
                  {current ? (
                    <span className="lowercase text-muted-foreground/70">
                      {formatModelSize(current.size)}
                    </span>
                  ) : null}
                </button>
              </div>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function FailState({
  reason,
  onRetry,
}: {
  reason: string;
  onRetry: () => void;
}) {
  return (
    <div className="px-3 py-4 font-mono text-xs">
      <p className="text-destructive">{reason || "Ollama unreachable"}</p>
      <p className="mt-1 text-muted-foreground">
        Ensure <code>ollama serve</code> is running.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 inline-flex items-center gap-1.5 text-foreground hover:text-led-amber"
      >
        <RefreshCcw className="size-3" aria-hidden="true" /> Retry
      </button>
    </div>
  );
}
