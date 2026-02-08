import { Box, Text } from "ink";

import { Footer } from "~/cli/components";
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
    <Box flexDirection="column" paddingX={1} paddingTop={1}>
      <ChatHistory
        messages={state.messages}
        streamingResponse={state.streamingResponse}
        modelName={state.model}
      />

      <Box
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        height={1}
        marginBottom={0}
      >
        <Box>{state.statusContent}</Box>
        <Box>
          <Text dimColor>
            {state.model} ({state.provider})
          </Text>
        </Box>
      </Box>

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
