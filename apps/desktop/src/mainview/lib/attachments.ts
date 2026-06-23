import type {
  MessagePart,
  MultimodalContent,
  UIMessage,
} from "@tanstack/ai-client";

/**
 * Provider-agnostic file attachment, decoupled from any chat SDK's part shape.
 *
 * `url` is always a `data:` URL so the value is self-contained (survives DB
 * round-trips and renders directly in an <img>). Conversion to / from
 * TanStack AI message parts lives here so the chat store, composer, and
 * message panel share one representation.
 */
export interface Attachment {
  mediaType: string;
  filename?: string;
  url: string;
}

/** Element type accepted inside `MultimodalContent.content` (TanStack `ContentPart`). */
export type ChatContentPart = Extract<
  MultimodalContent["content"],
  readonly unknown[]
>[number];

/** TanStack content-part kinds that carry a binary `source` (vs text/tool/thinking). */
const FILE_PART_TYPES = new Set(["image", "audio", "video", "document"]);

type FilePartSource = {
  type: "data" | "url";
  value: string;
  mimeType?: string;
};
type FilePartLike = {
  type: string;
  source?: FilePartSource;
  metadata?: { filename?: string };
};

/** Strip the `data:<mime>;base64,` prefix, leaving the bare base64 payload. */
const dataUrlPayload = (url: string): string => {
  const comma = url.indexOf(",");
  return comma !== -1 ? url.slice(comma + 1) : url;
};

const partKindFor = (
  mediaType: string,
): "image" | "audio" | "video" | "document" => {
  if (mediaType.startsWith("image/")) return "image";
  if (mediaType.startsWith("audio/")) return "audio";
  if (mediaType.startsWith("video/")) return "video";
  return "document";
};

const fileToAttachment = (file: File): Promise<Attachment> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () =>
      resolve({
        mediaType: file.type || "application/octet-stream",
        filename: file.name,
        url: reader.result as string,
      }),
    );
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });

/** Read a picked `FileList` into self-contained data-URL attachments. */
export const fileListToAttachments = (list: FileList): Promise<Attachment[]> =>
  Promise.all([...list].map(fileToAttachment));

/** Attachment → TanStack content part (`image`/`audio`/`video`/`document`). */
export const attachmentToPart = (att: Attachment): ChatContentPart =>
  ({
    type: partKindFor(att.mediaType),
    source: {
      type: "data",
      value: dataUrlPayload(att.url),
      mimeType: att.mediaType,
    },
    ...(att.filename && { metadata: { filename: att.filename } }),
  }) as ChatContentPart;

/** TanStack message part → Attachment, or `null` for non-file parts (text, tool…). */
export const partToAttachment = (part: MessagePart): Attachment | null => {
  if (!FILE_PART_TYPES.has(part.type)) return null;
  const { source, metadata } = part as FilePartLike;
  if (!source) return null;
  const mediaType = source.mimeType ?? "application/octet-stream";
  const url =
    source.type === "data"
      ? `data:${mediaType};base64,${source.value}`
      : source.value;
  return { mediaType, filename: metadata?.filename, url };
};

/** Extract every file attachment from a message's parts, in order. */
export const messageAttachments = (m: UIMessage): Attachment[] =>
  m.parts.map(partToAttachment).filter((a): a is Attachment => a !== null);
