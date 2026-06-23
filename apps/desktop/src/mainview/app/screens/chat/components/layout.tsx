import { useSelector } from "@tanstack/react-store";

import { DRAG } from "~/lib/drag-region";
import { cn } from "~/lib/utils";
import { SidebarInset, SidebarProvider } from "~/ui/sidebar";
import { ChatProvider, useChatContext } from "../store";
import { ChatPanel } from "./panel";
import { ChatSidebar } from "./sidebar";
import { ChatTopBar } from "./top-bar";

export function ChatLayout() {
  return (
    <ChatProvider>
      <ChatLayoutContent />
    </ChatProvider>
  );
}

function ChatLayoutContent() {
  const { store } = useChatContext();
  const model = useSelector(store, (s) => s.model);
  const conversationId = useSelector(store, (s) => s.conversationId);

  return (
    <SidebarProvider>
      <ChatSidebar
        activeConversationId={conversationId}
        onSelectConversation={store.actions.setConversationId}
      />
      <SidebarInset
        className={cn("flex h-dvh flex-col bg-background pt-8", DRAG)}
      >
        <ChatTopBar model={model} onModelChange={store.actions.setModel} />
        <main className="min-h-0 flex-1 overflow-hidden">
          <ChatPanel />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
