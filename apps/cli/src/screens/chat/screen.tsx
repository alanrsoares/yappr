import { formatTelemetry } from "@yappr/lib/telemetry";
import { Box, Text } from "ink";

import { Footer, Header } from "~/components";
import { useKeyboard, useTerminalWidth } from "~/hooks";
import { truncateDisplayWidth } from "~/string-display.js";
import { semantic } from "~/theme/semantic.js";
import type { ScreenId } from "~/types.js";
import { ChatHistory } from "./components/chat-history.js";
import { ChatInput } from "./components/chat-input.js";
import { EventStreamView } from "./components/event-stream-view.js";
import { useChatController } from "./store.js";

export interface ChatScreenProps {
  onBack: () => void;
  onNavigate?: (screen: ScreenId) => void;
}

export function ChatScreen({ onBack, onNavigate }: ChatScreenProps) {
  const [state, actions] = useChatController({ onBack, onNavigate });
  const terminalWidth = useTerminalWidth();

  useKeyboard({
    bindings: [
      { keys: ["escape"], action: actions.dismissSlashOrBack },
      { keys: ["ctrl+c"], action: actions.stopChat },
      { keys: ["ctrl+v"], action: actions.attachImageFromClipboard },
      { keys: ["ctrl+x"], action: actions.clearAttachments },
    ],
  });

  const subtitleRaw = `${state.model} · ${state.provider} · TTS: ${state.voice}`;
  const innerCols = Math.max(8, terminalWidth - 2);
  const subtitle = truncateDisplayWidth(subtitleRaw, innerCols);

  return (
    <Box
      flexDirection="column"
      padding={1}
      width={terminalWidth}
      flexShrink={0}
      flexGrow={0}
    >
      <Header
        title={state.isEventStreamOpen ? "Events" : "Chat"}
        subtitle={subtitle}
      />

      {state.isEventStreamOpen ? (
        <Box
          flexDirection="column"
          flexGrow={1}
          minHeight={4}
          borderStyle="round"
          borderColor={semantic.border.historyFrame}
          paddingX={1}
          paddingY={0}
          marginBottom={1}
        >
          <EventStreamView
            events={state.events}
            width={terminalWidth}
            onClose={actions.closeEventStream}
          />
        </Box>
      ) : (
        <ChatHistory
          messages={state.messages}
          streamingResponse={state.streamingResponse}
          modelName={state.model}
        />
      )}

      {!state.isEventStreamOpen && (
        <Box flexDirection="column" marginBottom={1} minHeight={1}>
          {state.statusContent}
        </Box>
      )}

      {state.slashNotice !== null && state.slashNotice !== "" && (
        <Box flexDirection="column" marginBottom={1}>
          {state.slashNotice.split("\n").map((line, i) => (
            <Text key={i} color={semantic.notice}>
              {line}
            </Text>
          ))}
        </Box>
      )}

      {!state.isEventStreamOpen && state.pendingAttachments.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          {state.pendingAttachments.map((path, i) => (
            <Text key={`${i}-${path}`} color={semantic.accent}>
              [Image #{i + 1}] {path.split("/").pop() ?? path}
            </Text>
          ))}
          <Text dimColor>ctrl+x clears all attachments</Text>
        </Box>
      )}

      {!state.isEventStreamOpen && state.telemetry !== null && (
        <Box marginBottom={1}>
          <Text dimColor>{formatTelemetry(state.telemetry)}</Text>
        </Box>
      )}

      {!state.isEventStreamOpen && (
        <ChatInput
          value={state.value}
          cursor={state.cursor}
          onChange={actions.handleInputChange}
          onComposerSubmit={actions.handleComposerSubmit}
          placeholder={`Message ${state.model}… (type / for commands)`}
        />
      )}

      <Footer items={state.footerItems} />
    </Box>
  );
}
