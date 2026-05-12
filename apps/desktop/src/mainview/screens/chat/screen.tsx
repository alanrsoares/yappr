import { ChatLayout } from "./chat-layout";
import { ChatPanel } from "./chat-panel";

export function ChatScreen() {
  return (
    <ChatLayout
      renderMain={({ model, onModelChange }) => (
        <ChatPanel model={model} onModelChange={onModelChange} />
      )}
    />
  );
}
