import { useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";

import { useChat, type UIMessage } from "@tanstack/ai-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createStoreContext,
  useCreateStore,
  useSelector,
} from "@tanstack/react-store";
import type { Store } from "@tanstack/store";
import type { MessageRow } from "@yappr/db/rpc";

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
 * Chat client/UI state — the only state shared across the chat subtree. The
 * `useChat` runtime (messages, streaming status, send/stop) is NOT here: it
 * lives in {@link useChatSession}, consumed only by the panel. Server state
 * (models, messages, prefs) stays in TanStack Query, read directly.
 */
interface ChatClientState {
  model: string;
  conversationId: string | null;
  inputDeviceId: string | null;
}

interface ChatClientActions extends Record<string, (...args: never[]) => void> {
  setModel: (next: string) => void;
  setConversationId: (id: string | null) => void;
  setInputDeviceId: (v: string | null) => void;
}

type ChatStore = Store<ChatClientState, ChatClientActions>;

const { StoreProvider, useStoreContext } = createStoreContext<{
  store: ChatStore;
}>();

/** Access the chat client store (model / conversationId / inputDeviceId). */
export const useChatContext = useStoreContext;

const persist = (entries: Record<string, unknown>) =>
  void dbRpc.request("preferences:setMany", entries).catch(() => {});

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

/**
 * Provides the chat client store to its subtree and coordinates client state
 * with persisted prefs + the installed-models list. The `useChat` runtime is
 * intentionally absent here — see {@link useChatSession}.
 */
export function ChatProvider({ children }: { children: ReactNode }) {
  const store = useCreateStore<ChatClientState, ChatClientActions>(
    {
      model: DEFAULT_CHAT_MODEL,
      conversationId: null,
      inputDeviceId: null,
    },
    ({ setState }) => ({
      setModel: (next) => {
        setState((s) => ({ ...s, model: next }));
        persist({ defaultChatModel: next });
      },
      setConversationId: (id) =>
        setState((s) => ({ ...s, conversationId: id })),
      setInputDeviceId: (next) => {
        setState((s) => ({ ...s, inputDeviceId: next }));
        // Empty string round-trips as "system default" (null on the renderer).
        persist({ defaultInputDeviceId: next ?? "" });
      },
    }),
  );

  // Hydrate once from persisted prefs (setState directly so we don't re-persist).
  const { data: prefs } = useQuery(preferencesOptions);
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (!prefs || hydratedRef.current) return;
    hydratedRef.current = true;
    store.setState((s) => ({
      ...s,
      ...(typeof prefs.defaultChatModel === "string" && prefs.defaultChatModel
        ? { model: prefs.defaultChatModel }
        : {}),
      ...(typeof prefs.defaultInputDeviceId === "string"
        ? { inputDeviceId: prefs.defaultInputDeviceId || null }
        : {}),
    }));
  }, [prefs, store]);

  // Keep the selected model valid as the installed-models list arrives.
  const { data: models } = useQuery(ollamaModelsOptions);
  useEffect(() => {
    if (!models || models.length === 0) return;
    store.setState((s) => ({ ...s, model: pickModel(s.model)(models) }));
  }, [models, store]);

  return <StoreProvider value={{ store }}>{children}</StoreProvider>;
}

export interface ChatSession {
  messages: UIMessage[];
  status: "submitted" | "streaming" | "ready" | "error";
  error: Error | undefined;
  isBusy: boolean;
  showLoading: boolean;
  modelReady: boolean;
  modelsLoaded: boolean;
  submit: (text: string, files: Attachment[]) => Promise<void>;
  regenerateMessage: (messageId: string) => Promise<void>;
  stop: () => void;
}

/**
 * The `useChat`-driven chat runtime. Single-instance: mount it once, in the
 * panel. Reads client state from {@link useChatContext}; server state comes
 * from TanStack Query. Returns everything the message list + composer need.
 */
export function useChatSession(): ChatSession {
  const { store } = useChatContext();
  const queryClient = useQueryClient();
  const model = useSelector(store, (s) => s.model);
  const conversationId = useSelector(store, (s) => s.conversationId);

  const { data: models } = useQuery(ollamaModelsOptions);
  const { data } = useQuery(messagesOptions(conversationId));
  // Stable empty-array ref so the hydration effect doesn't loop while the
  // query is disabled (conversationId === null) and `data` stays undefined.
  const persisted = useMemo<MessageRow[]>(() => data ?? [], [data]);

  // Live conversation id captured at send-time so onFinish writes to the right
  // row even if the user navigates between conversations mid-stream.
  const liveConvIdRef = useRef<string | null>(conversationId);
  const persistedMessageIdsRef = useRef(new Map<string, string>());
  const pendingRegenerateMessageIdRef = useRef<string | null>(null);
  useEffect(() => {
    persistedMessageIdsRef.current = new Map(
      persisted.map((m) => [m.id, m.id]),
    );
  }, [persisted]);

  // useChat freezes the connection at first render; read the live model via a
  // ref so switching models takes effect without recreating the chat instance.
  const modelRef = useRef(model);
  useEffect(() => {
    modelRef.current = model;
  }, [model]);
  const connection = useMemo(
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
        const saved = await dbRpc.request("messages:append", {
          conversationId: convId,
          role: "assistant",
          content: text,
        });
        persistedMessageIdsRef.current.set(message.id, saved.id);
        if (regeneratedMessageId) {
          await dbRpc.request("messages:delete", { id: regeneratedMessageId });
        }
        queryClient.invalidateQueries({
          queryKey: messagesOptions(convId).queryKey,
        });
        queryClient.invalidateQueries({ queryKey: conversationsQueryRootKey });
      },
      onError: () => {
        pendingRegenerateMessageIdRef.current = null;
      },
    });

  // Hydrate messages from the DB when the conversation / persisted list
  // changes, skipping in-flight streams so live messages aren't clobbered.
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

  const submit = useCallback(
    async (text: string, files: Attachment[]) => {
      if (!text.trim() && files.length === 0) return;
      let convId = store.state.conversationId;
      if (!convId) {
        const conv = await dbRpc.request("conversations:create", {
          title: truncateTitle(userRowContent(text, files)),
          model: store.state.model,
        });
        convId = conv.id;
        store.actions.setConversationId(convId);
        queryClient.invalidateQueries({ queryKey: conversationsQueryRootKey });
      }
      liveConvIdRef.current = convId;
      const parts = buildUserParts(text, files);
      const partsJson = files.length > 0 ? JSON.stringify(parts) : undefined;
      await dbRpc.request("messages:append", {
        conversationId: convId,
        role: "user",
        content: userRowContent(text, files),
        partsJson,
      });
      await (files.length > 0
        ? sendMessage({ content: parts })
        : sendMessage(text.trim()));
    },
    [store, sendMessage, queryClient],
  );

  const regenerateMessage = useCallback(
    async (messageId: string) => {
      if (isBusy) return;
      pendingRegenerateMessageIdRef.current = store.state.conversationId
        ? (persistedMessageIdsRef.current.get(messageId) ?? messageId)
        : null;
      try {
        await reload();
      } catch {
        pendingRegenerateMessageIdRef.current = null;
      }
    },
    [store, isBusy, reload],
  );

  return {
    messages,
    status,
    error,
    isBusy,
    showLoading,
    modelReady,
    modelsLoaded: Boolean(models),
    submit,
    regenerateMessage,
    stop,
  };
}
