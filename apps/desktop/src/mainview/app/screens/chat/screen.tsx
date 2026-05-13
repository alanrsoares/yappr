import { ChatLayout } from "./components/chat-layout";
import { ChatPanel } from "./components/chat-panel";

export function ChatScreen() {
  return (
    <ChatLayout
      renderMain={({
        model,
        onModelChange,
        conversationId,
        onConversationChange,
      }) => (
        <ChatPanel
          model={model}
          onModelChange={onModelChange}
          conversationId={conversationId}
          onConversationChange={onConversationChange}
        />
      )}
    />
  );
}
