import { useCallback, useState, type ReactNode } from "react";

import { convertFileListToFileUIParts, type FileUIPart } from "ai";
import { ArrowUp, Paperclip, Square, X } from "lucide-react";

import { cn } from "~/lib/utils";
import { Button } from "~/ui/button";
import {
  FileUpload,
  FileUploadContent,
  FileUploadTrigger,
} from "~/ui/file-upload";
import {
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from "~/ui/prompt-input";
import { MicButton } from "./components/mic-button";

const MAX_ATTACHMENTS = 6;
const MAX_FILE_BYTES = 4 * 1024 * 1024;

function filesToFileList(files: File[]): FileList {
  const dt = new DataTransfer();
  for (const f of files) {
    dt.items.add(f);
  }
  return dt.files;
}

export type ComposerProps = {
  onSend: (text: string, files: FileUIPart[]) => void;
  isBusy: boolean;
  onStop: () => void;
  leadingSlot?: ReactNode;
  disabled?: boolean;
  placeholder?: string;
  /** When provided, surfaces a mic button that records audio and appends the
   *  transcript to the current draft. Pass the voice store's `transcribe`. */
  transcribe?: (blob: Blob) => Promise<string>;
};

/**
 * Wraps prompt-kit `PromptInput` with send/stop semantics (RecallOS-style).
 * File picking + global drag/drop follow prompt-kit `FileUpload` + Prompt
 * Input composition (see https://www.prompt-kit.com/docs/file-upload).
 */
export function Composer({
  onSend,
  isBusy,
  onStop,
  leadingSlot,
  disabled,
  placeholder,
  transcribe,
}: ComposerProps) {
  const [draft, setDraft] = useState("");
  const [pendingFiles, setPendingFiles] = useState<FileUIPart[]>([]);
  const [attachBusy, setAttachBusy] = useState(false);

  const trimmedLength = draft.trim().length;
  const canSend =
    (trimmedLength > 0 || pendingFiles.length > 0) &&
    !isBusy &&
    !disabled &&
    !attachBusy;

  const submit = () => {
    if (!canSend) return;
    onSend(draft.trim(), pendingFiles);
    setDraft("");
    setPendingFiles([]);
  };

  const appendTranscript = (text: string) => {
    setDraft((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
  };

  const removeFile = useCallback((index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const ingestFileList = useCallback(async (list: FileList | null) => {
    if (!list?.length) return;
    setAttachBusy(true);
    try {
      const converted = await convertFileListToFileUIParts(list);
      const sizedOk = converted.filter((p) => {
        if (p.url.startsWith("data:")) {
          return p.url.length <= MAX_FILE_BYTES * 2;
        }
        return true;
      });
      setPendingFiles((prev) => {
        const room = MAX_ATTACHMENTS - prev.length;
        if (room <= 0) return prev;
        return [...prev, ...sizedOk.slice(0, room)];
      });
    } finally {
      setAttachBusy(false);
    }
  }, []);

  const onFilesAdded = useCallback(
    (files: File[]) => {
      if (!files.length) return;
      void ingestFileList(filesToFileList(files));
    },
    [ingestFileList],
  );

  return (
    <FileUpload
      onFilesAdded={onFilesAdded}
      multiple
      disabled={!!disabled || isBusy || attachBusy}
    >
      <PromptInput
        value={draft}
        onValueChange={setDraft}
        onSubmit={submit}
        isLoading={isBusy}
        disabled={disabled}
        className="border-black/60 bg-chassis-deep p-0 shadow-bezel-deep"
      >
        <div className="flex flex-col">
          {pendingFiles.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5 border-b border-black/40 px-3 py-2">
              {pendingFiles.map((f, i) => (
                <li
                  key={`pending-${i}`}
                  className="flex max-w-[200px] items-center gap-1 rounded-md border border-black/40 bg-black/20 px-2 py-1 font-mono text-[10px] text-foil"
                >
                  <span className="truncate" title={f.filename}>
                    {f.filename ?? f.mediaType}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-5 shrink-0 text-foil-dim hover:text-foreground"
                    aria-label={`Remove ${f.filename ?? "file"}`}
                    onClick={() => removeFile(i)}
                  >
                    <X className="size-3" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
          <PromptInputTextarea
            placeholder={placeholder ?? "Message Ollama…"}
            className="min-h-[52px] px-3 pt-3 pb-2 text-foil placeholder:text-foil-dim"
          />

          <PromptInputActions className="w-full justify-between gap-2 border-t border-black/50 px-2 py-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2 text-[0.65rem] uppercase tracking-wider text-foil-mute">
              <PromptInputAction tooltip="Attach files" side="top">
                <FileUploadTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    disabled={
                      isBusy ||
                      disabled ||
                      attachBusy ||
                      pendingFiles.length >= MAX_ATTACHMENTS
                    }
                    aria-label="Attach files"
                    className="size-8 text-foil hover:text-led-amber"
                  >
                    <Paperclip className="size-4" />
                  </Button>
                </FileUploadTrigger>
              </PromptInputAction>
              {transcribe ? (
                <MicButton
                  onTranscript={appendTranscript}
                  transcribe={transcribe}
                  disabled={isBusy || disabled}
                />
              ) : null}
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
      <FileUploadContent />
    </FileUpload>
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
