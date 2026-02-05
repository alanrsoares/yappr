import { Box } from "ink";

import { Footer, Header } from "~/cli/components";
import { DEFAULT_KEYS } from "~/cli/constants.js";
import { useKeyboard } from "~/cli/hooks";
import { quit } from "~/cli/quit.js";
import { ChatHistory } from "./components/chat-history.js";
import { ChatInput } from "./components/chat-input.js";
import { ChatProvider, useChatStore } from "./store.js";

export interface ChatScreenProps {
  onBack: () => void;
}

export function ChatScreen({ onBack }: ChatScreenProps) {
  return (
    <ChatProvider initialState={{ onBack }}>
      <ChatScreenContent />
    </ChatProvider>
  );
}

function ChatScreenContent() {
  const [state, actions] = useChatStore();

  useKeyboard({
    bindings: [
      { keys: ["escape"], action: actions.onBack },
      { keys: ["ctrl+c"], action: actions.stopChat },
      {
        keys: [...DEFAULT_KEYS.quit],
        action: () => {
          actions.stopStt();
          actions.stopChat();
          quit();
        },
      },
    ],
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Header
        title="Chat"
        subtitle={`${state.provider}: ${state.model}  ·  Voice: ${state.voice}${state.useNarrationForTTS ? "  ·  Narration: on" : ""}`}
      />

      <ChatHistory
        messages={state.messages}
        streamingResponse={state.streamingResponse}
        modelName={state.model}
        statusContent={state.statusContent}
        showStatusLine={state.showStatusLine}
      />

      <ChatInput
        value={state.value}
        onChange={actions.handleInputChange}
        onSubmit={actions.handleSubmit}
        placeholder={`Ask ${state.model}… or press ctrl+t`}
      />

      <Footer items={state.footerItems} />
    </Box>
  );
}
