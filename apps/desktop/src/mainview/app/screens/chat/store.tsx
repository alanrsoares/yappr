import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useChat, type UIMessage } from "@tanstack/ai-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MessageRow } from "@yappr/db/rpc";
import { createContainer } from "@yappr/lib/unstated";

import {
  attachmentToPart,
  type Attachment,
  type ChatContentPart,
} from "~/lib/attachments";
import { dbRpc } from "~/lib/db-rpc";
import {
  conversationsQueryRootKey,
  messagesOptions,
  ollamaModelsOptions,
  preferencesOptions,
} from "~/lib/queries";
import { DEFAULT_CHAT_MODEL, pickModel } from "~/services/ollama";
import { createOllamaConnection } from "~/services/ollama/transport";

/**
 * Chat-feature container — colocated with the screen it powers, mirroring
 * the CLI's per-screen store layout (apps/cli/src/screens/[name]/store.tsx).
 * Owns chat-only state and side effects that should not leak into the
 * cross-screen voice runtime (TTS/STT/health).
 */
type ChatRuntimeStatus = "submitted" | "streaming" | "ready" | "error";

export interface ChatStoreState {
  model: string;
  conversationId: string | null;
  messages: UIMessage[];
  status: ChatRuntimeStatus;
  error: Error | undefined;
  isBusy: boolean;
  showLoading: boolean;
  modelReady: boolean;
  modelsLoaded: boolean;
  inputDeviceId: string | null;
}

export interface ChatStoreActions {
  setModel: (next: string) => void;
  setConversationId: (id: string | null) => void;
  setInputDeviceId: (v: string | null) => void;
  submit: (text: string, files: Attachment[]) => Promise<void>;
  regenerateMessage: (messageId: string) => Promise<void>;
  stop: () => void;
}

export type ChatStoreValue = readonly [ChatStoreState, ChatStoreActions];

const truncateTitle = (text: string): string => {
  const trimmed = text.trim().replace(/\s+/g, " ");
  return trimmed.length > 48 ? `${trimmed.slice(0, 48)}...` : trimmed;
};

function dbToUIMessage(m: MessageRow): UIMessage {
  if (m.partsJson) {
    try {
      const parsed = JSON.parse(m.partsJson) as unknown;
      if (Array.isArray(parsed) && parsed.length > 0) {
        return {
          id: m.id,
          role: m.role,
          parts: parsed as UIMessage["parts"],
        };
      }
    } catch {
      /* legacy / corrupt row - fall through */
    }
  }
  return {
    id: m.id,
    role: m.role,
    parts: [{ type: "text", content: m.content }],
  };
}

const buildUserParts = (
  text: string,
  files: Attachment[],
): ChatContentPart[] => {
  const trimmed = text.trim();
  const out: ChatContentPart[] = files.map(attachmentToPart);
  if (trimmed) out.push({ type: "text", content: trimmed });
  return out;
};

const userRowContent = (text: string, files: Attachment[]): string => {
  const t = text.trim();
  if (t) return t;
  if (files.length === 0) return "";
  return files.map((f) => f.filename ?? f.mediaType).join(", ");
};

export const chatMessageText = (m: UIMessage): string =>
  m.parts.map((p) => (p.type === "text" ? (p.content ?? "") : "")).join("");

function useChatStoreLogic(): ChatStoreValue {
  const queryClient = useQueryClient();
  const [model, setModel] = useState(DEFAULT_CHAT_MODEL);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [inputDeviceId, setInputDeviceId] = useState<string | null>(null);
  // Live conversation id captured at send-time so onFinish writes to the
  // right row even if the user navigates between conversations mid-stream.
  const liveConvIdRef = useRef<string | null>(conversationId);
  const persistedMessageIdsRef = useRef(new Map<string, string>());
  const pendingRegenerateMessageIdRef = useRef<string | null>(null);

  const { data: prefs } = useQuery(preferencesOptions);
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (!prefs || hydratedRef.current) return;
    if (typeof prefs.defaultChatModel === "string" && prefs.defaultChatModel) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setModel(prefs.defaultChatModel);
    }
    if (typeof prefs.defaultInputDeviceId === "string") {
      // Empty string round-trips as "system default" (null on the renderer
      // side). See `setInputDeviceIdPersist` below for the inverse.
      setInputDeviceId(prefs.defaultInputDeviceId || null);
    }
    hydratedRef.current = true;
  }, [prefs]);

  const { data: models } = useQuery(ollamaModelsOptions);
  useEffect(() => {
    if (!models || models.length === 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setModel((prev) => pickModel(prev)(models));
  }, [models]);

  const { data } = useQuery(messagesOptions(conversationId));
  // Stable empty-array ref so the hydration effect below doesn't loop on
  // every render when the query is disabled (conversationId === null) and
  // `data` stays undefined.
  const persisted = useMemo<MessageRow[]>(() => data ?? [], [data]);
  useEffect(() => {
    persistedMessageIdsRef.current = new Map(
      persisted.map((m) => [m.id, m.id]),
    );
  }, [persisted]);

  const persistPrefs = useMutation({
    mutationFn: (entries: Record<string, unknown>) =>
      dbRpc.request("preferences:setMany", entries),
  });
  const createConv = useMutation({
    mutationFn: (title: string) =>
      dbRpc.request("conversations:create", { title, model }),
  });
  const appendMessage = useMutation({
    mutationFn: (params: {
      conversationId: string;
      role: "user" | "assistant";
      content: string;
      partsJson?: string;
    }) => dbRpc.request("messages:append", params),
  });
  const deleteMessage = useMutation({
    mutationFn: (id: string) => dbRpc.request("messages:delete", { id }),
  });

  // useChat freezes the transport at first render. Wrap the model lookup in a
  // ref-backed getter so picking a different model at runtime takes effect
  // without re-creating the chat instance (which would lose live state).
  const modelRef = useRef(model);
  useEffect(() => {
    modelRef.current = model;
  }, [model]);
  const connection = useMemo(
    // The closure is invoked later at send time, not during render - the lint
    // rule can't statically see that, so silence it.
    // eslint-disable-next-line react-hooks/refs
    () => createOllamaConnection(() => modelRef.current),
    [],
  );

  const { messages, reload, sendMessage, status, error, setMessages, stop } =
    useChat({
      connection,
      onFinish: async (message) => {
        const regeneratedMessageId = pendingRegenerateMessageIdRef.current;
        pendingRegenerateMessageIdRef.current = null;
        const convId = liveConvIdRef.current;
        if (!convId) return;
        const text = chatMessageText(message);
        if (!text) return;
        const saved = await appendMessage.mutateAsync({
          conversationId: convId,
          role: "assistant",
          content: text,
        });
        persistedMessageIdsRef.current.set(message.id, saved.id);
        if (regeneratedMessageId) {
          await deleteMessage.mutateAsync(regeneratedMessageId);
        }
        queryClient.invalidateQueries({
          queryKey: messagesOptions(convId).queryKey,
        });
        queryClient.invalidateQueries({
          queryKey: conversationsQueryRootKey,
        });
      },
      onError: () => {
        pendingRegenerateMessageIdRef.current = null;
      },
    });

  // Hydrate from the DB when the active conversation or persisted list
  // changes. Skip during an in-flight stream so the transport's live messages
  // aren't clobbered. setMessages is ref-stashed because useChat re-creates
  // its identity each render and would otherwise re-trigger the effect.
  const setMessagesRef = useRef(setMessages);
  useEffect(() => {
    setMessagesRef.current = setMessages;
  }, [setMessages]);
  useEffect(() => {
    if (status === "submitted" || status === "streaming") return;
    liveConvIdRef.current = conversationId;
    setMessagesRef.current(persisted.map(dbToUIMessage));
  }, [conversationId, persisted, status]);

  const isBusy = status === "submitted" || status === "streaming";
  const modelReady =
    Boolean(model) && (models?.some((m) => m.name === model) ?? false);
  const showLoading =
    status === "submitted" &&
    !messages.some(
      (m) => m.role === "assistant" && chatMessageText(m).length > 0,
    );

  const setModelPersist = useCallback(
    (next: string) => {
      setModel(next);
      persistPrefs.mutate({ defaultChatModel: next });
    },
    [persistPrefs],
  );

  const setInputDeviceIdPersist = useCallback(
    (next: string | null) => {
      setInputDeviceId(next);
      persistPrefs.mutate({ defaultInputDeviceId: next ?? "" });
    },
    [persistPrefs],
  );

  const submit = useCallback(
    async (text: string, files: Attachment[]) => {
      if (!text.trim() && files.length === 0) return;
      const titleSeed = userRowContent(text, files);

      let convId = conversationId;
      if (!convId) {
        const conv = await createConv.mutateAsync(truncateTitle(titleSeed));
        convId = conv.id;
        setConversationId(convId);
        queryClient.invalidateQueries({
          queryKey: conversationsQueryRootKey,
        });
      }
      liveConvIdRef.current = convId;
      const parts = buildUserParts(text, files);
      const partsJson = files.length > 0 ? JSON.stringify(parts) : undefined;
      await appendMessage.mutateAsync({
        conversationId: convId,
        role: "user",
        content: userRowContent(text, files),
        partsJson,
      });
      await (files.length > 0
        ? sendMessage({ content: parts })
        : sendMessage(text.trim()));
    },
    [conversationId, queryClient, createConv, appendMessage, sendMessage],
  );

  const regenerateMessage = useCallback(
    async (messageId: string) => {
      if (isBusy) return;
      pendingRegenerateMessageIdRef.current = conversationId
        ? (persistedMessageIdsRef.current.get(messageId) ?? messageId)
        : null;
      try {
        await reload();
      } catch {
        pendingRegenerateMessageIdRef.current = null;
      }
    },
    [conversationId, isBusy, reload],
  );

  return useMemo(
    () =>
      [
        {
          model,
          conversationId,
          messages,
          status,
          error,
          isBusy,
          showLoading,
          modelReady,
          modelsLoaded: Boolean(models),
          inputDeviceId,
        },
        {
          setModel: setModelPersist,
          setConversationId,
          setInputDeviceId: setInputDeviceIdPersist,
          submit,
          regenerateMessage,
          stop,
        },
      ] as const,
    [
      model,
      conversationId,
      messages,
      status,
      error,
      isBusy,
      showLoading,
      modelReady,
      models,
      inputDeviceId,
      setModelPersist,
      setInputDeviceIdPersist,
      submit,
      regenerateMessage,
      stop,
    ],
  );
}

export const { useContainer: useChatStore, Provider: ChatStoreProvider } =
  createContainer<ChatStoreValue>(useChatStoreLogic);
