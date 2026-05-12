import { useEffect, useState, type ReactNode } from "react";

import { useQuery } from "@tanstack/react-query";

import { DRAG } from "~/lib/drag-region";
import { DEFAULT_CHAT_MODEL, pickModel } from "~/lib/ollama";
import { ollamaModelsOptions } from "~/lib/queries";
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

  // Auto-correct the selected model when the Ollama tags list resolves: if
  // the current value isn't installed locally, fall back to the first
  // completion model. Same `pickX(current)(list)` pattern the voice store
  // uses for voice ids.
  const { data: models } = useQuery(ollamaModelsOptions);
  useEffect(() => {
    if (!models || models.length === 0) return;
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
        <ChatTopBar model={model} onModelChange={setModel} />
        <main className="min-h-0 flex-1 overflow-hidden">
          {renderMain({
            model,
            onModelChange: setModel,
            conversationId,
            onConversationChange: setConversationId,
          })}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
