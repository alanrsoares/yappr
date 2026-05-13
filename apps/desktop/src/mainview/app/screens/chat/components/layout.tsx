import { DRAG } from "~/lib/drag-region";
import { cn } from "~/lib/utils";
import { SidebarInset, SidebarProvider } from "~/ui/sidebar";
import { ChatStoreProvider, useChatStore } from "../store";
import { ChatPanel } from "./panel";
import { ChatSidebar } from "./sidebar";
import { ChatTopBar } from "./top-bar";

export function ChatLayout() {
  return (
    <ChatStoreProvider>
      <ChatLayoutContent />
    </ChatStoreProvider>
  );
}

function ChatLayoutContent() {
  const [{ model, conversationId }, { setModel, setConversationId }] =
    useChatStore();

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
          <ChatPanel />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
