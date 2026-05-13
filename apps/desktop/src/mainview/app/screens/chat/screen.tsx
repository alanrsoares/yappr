import { ChatLayout } from "./components/layout";
import { ChatPanel } from "./components/panel";

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
