import { ChatLayout } from "./chat-layout";
import { ChatPanel } from "./chat-panel";

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
