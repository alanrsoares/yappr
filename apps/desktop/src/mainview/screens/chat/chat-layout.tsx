import { useState, type ReactNode } from "react";

import { DRAG } from "~/lib/drag-region";
import { cn } from "~/lib/utils";
import { SidebarInset, SidebarProvider } from "~/ui/sidebar";
import { ChatSidebar } from "./chat-sidebar";
import { ChatTopBar } from "./chat-top-bar";

interface ChatLayoutProps {
  renderMain: (props: {
    model: string;
    onModelChange: (next: string) => void;
  }) => ReactNode;
}

export function ChatLayout({ renderMain }: ChatLayoutProps) {
  const [model, setModel] = useState("llama3.2");

  return (
    <SidebarProvider>
      <ChatSidebar />
      <SidebarInset
        className={cn("flex h-dvh flex-col bg-background pt-8", DRAG)}
      >
        <ChatTopBar model={model} onModelChange={setModel} />
        <main className="min-h-0 flex-1 overflow-hidden">
          {renderMain({ model, onModelChange: setModel })}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
