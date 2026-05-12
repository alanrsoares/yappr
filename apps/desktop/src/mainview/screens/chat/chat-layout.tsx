import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useMutation, useQuery } from "@tanstack/react-query";

import { dbRpc } from "~/lib/db-rpc";
import { DRAG } from "~/lib/drag-region";
import { DEFAULT_CHAT_MODEL, pickModel } from "~/lib/ollama";
import { ollamaModelsOptions, preferencesOptions } from "~/lib/queries";
import { cn } from "~/lib/utils";
import { SidebarInset, SidebarProvider } from "~/ui/sidebar";
import { ChatSidebar } from "./chat-sidebar";
import { ChatTopBar } from "./chat-top-bar";

interface ChatLayoutProps {
  renderMain: (props: {
    model: string;
    onModelChange: (next: string) => void;
    conversationId: string | null;
    onConversationChange: (id: string | null) => void;
  }) => ReactNode;
}

export function ChatLayout({ renderMain }: ChatLayoutProps) {
  const [model, setModel] = useState(DEFAULT_CHAT_MODEL);
  // Active conversation. `null` = the "draft" state — composer is enabled but
  // the first send will create a conversation on the fly. Selecting a row in
  // the sidebar sets this to that conversation's id.
  const [conversationId, setConversationId] = useState<string | null>(null);

  // Hydrate model from persisted preferences (shared with the CLI under the
  // `defaultChatModel` key) on first prefs arrival. Subsequent changes write
  // back through the persist mutation.
  const { data: prefs } = useQuery(preferencesOptions);
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (!prefs || hydratedRef.current) return;
    if (typeof prefs.defaultChatModel === "string" && prefs.defaultChatModel) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setModel(prefs.defaultChatModel);
    }
    hydratedRef.current = true;
  }, [prefs]);

  const persistModel = useMutation({
    mutationFn: (next: string) =>
      dbRpc.request("preferences:setMany", { defaultChatModel: next }),
  });

  const handleModelChange = useCallback(
    (next: string) => {
      setModel(next);
      persistModel.mutate(next);
    },
    [persistModel],
  );

  // Auto-correct the selected model when the Ollama tags list resolves: if
  // the current value isn't installed locally, fall back to the first
  // completion model. Same `pickX(current)(list)` pattern the voice store
  // uses for voice ids.
  const { data: models } = useQuery(ollamaModelsOptions);
  useEffect(() => {
    if (!models || models.length === 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setModel((prev) => pickModel(prev)(models));
  }, [models]);

  return (
    <SidebarProvider>
      <ChatSidebar
        activeConversationId={conversationId}
        onSelectConversation={setConversationId}
      />
      <SidebarInset
        className={cn("flex h-dvh flex-col bg-background pt-8", DRAG)}
      >
        <ChatTopBar model={model} onModelChange={handleModelChange} />
        <main className="min-h-0 flex-1 overflow-hidden">
          {renderMain({
            model,
            onModelChange: handleModelChange,
            conversationId,
            onConversationChange: setConversationId,
          })}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
