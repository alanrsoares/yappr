import { Box, Text } from "ink";

import { Footer, Header } from "~/cli/components";
import { useKeyboard } from "~/cli/hooks";
import type { ScreenId } from "~/cli/types.js";
import { ChatHistory } from "./components/chat-history.js";
import { ChatInput } from "./components/chat-input.js";
import { ChatProvider, useChatStore } from "./store.js";

export interface ChatScreenProps {
  onBack: () => void;
  onNavigate?: (screen: ScreenId) => void;
}

export function ChatScreen({ onBack, onNavigate }: ChatScreenProps) {
  return (
    <ChatProvider initialState={{ onBack, onNavigate }}>
      <ChatScreenContent />
    </ChatProvider>
  );
}

function ChatScreenContent() {
  const [state, actions] = useChatStore();

  useKeyboard({
    bindings: [
      { keys: ["escape"], action: actions.dismissSlashOrBack },
      { keys: ["ctrl+c"], action: actions.stopChat },
    ],
  });

  const subtitle = `${state.model} · ${state.provider} · TTS: ${state.voice}`;

  return (
    <Box flexDirection="column" padding={1} height="100%">
      <Header title="Chat" subtitle={subtitle} />

      <Box
        flexDirection="column"
        flexGrow={1}
        minHeight={4}
        borderStyle="round"
        borderColor="gray"
        paddingX={1}
        paddingY={0}
        marginBottom={1}
      >
        <ChatHistory
          messages={state.messages}
          streamingResponse={state.streamingResponse}
          modelName={state.model}
        />
      </Box>

      <Box flexDirection="column" marginBottom={1} minHeight={1}>
        {state.statusContent}
      </Box>

      {state.slashNotice !== null && state.slashNotice !== "" && (
        <Box flexDirection="column" marginBottom={1}>
          {state.slashNotice.split("\n").map((line, i) => (
            <Text key={i} color="yellow">
              {line}
            </Text>
          ))}
        </Box>
      )}

      <ChatInput
        value={state.value}
        onChange={actions.handleInputChange}
        onComposerSubmit={actions.handleComposerSubmit}
        placeholder={`Message ${state.model}… (type / for commands)`}
      />

      <Footer items={state.footerItems} />
    </Box>
  );
}
