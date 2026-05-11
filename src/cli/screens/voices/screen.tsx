import { Box, Text } from "ink";

import { Footer, Header, Loading } from "~/cli/components";
import { footerVoices } from "~/cli/footer-items.js";
import { semantic } from "~/cli/theme/semantic.js";
import { useVoicesStore, VoicesProvider } from "./store.js";

export interface VoicesScreenProps {
  onBack: () => void;
}

export function VoicesScreen({ onBack }: VoicesScreenProps) {
  return (
    <VoicesProvider initialState={{ onBack }}>
      <VoicesScreenContent />
    </VoicesProvider>
  );
}

function VoicesScreenContent() {
  const [state] = useVoicesStore();
  const {
    voices,
    error,
    isLoading,
    phraseCustom,
    phrase,
    previewStatus,
    previewError,
    filtered,
    len,
    effectiveIndex,
    filterText,
  } = state;

  return (
    <Box flexDirection="column" padding={1}>
      <Header
        title="Voices"
        subtitle="TTS from server — ↑/↓ select · Ctrl+p sample · Ctrl+e custom phrase · Enter play"
      />
      {isLoading ? (
        <Loading message="Loading voices..." />
      ) : error ? (
        <Text color={semantic.error}>{error.message}</Text>
      ) : len === 0 ? (
        <Text dimColor>
          {voices.length === 0
            ? "No voices returned."
            : "No voices match filter."}
        </Text>
      ) : (
        <Box flexDirection="column" marginTop={1}>
          {phraseCustom ? (
            <Box flexDirection="column" marginBottom={1}>
              <Text dimColor>
                Preview phrase (↑/↓ change voice). Enter plays, Esc leaves
                phrase mode, Ctrl+e closes editor.
              </Text>
              <Text>{phrase}</Text>
            </Box>
          ) : (
            <Text dimColor>
              Ctrl+p fixed sample · Ctrl+e type your own · Enter plays sample
              for selection
            </Text>
          )}
          <Box marginTop={phraseCustom ? 0 : 1}>
            <Text dimColor>Filter: </Text>
            <Text>{filterText || "(type to filter)"}</Text>
          </Box>
          {previewStatus === "loading" ? (
            <Text dimColor>Synthesizing…</Text>
          ) : null}
          {previewStatus === "error" && previewError ? (
            <Text color={semantic.error}>{previewError}</Text>
          ) : null}
          {previewStatus === "ok" ? (
            <Text color={semantic.success}>Playing.</Text>
          ) : null}
          <Box flexDirection="column" marginTop={1}>
            {filtered.map((v, i) => (
              <Text
                key={v}
                color={i === effectiveIndex ? semantic.accent : undefined}
              >
                {i === effectiveIndex ? "› " : "  "}
                {v}
              </Text>
            ))}
          </Box>
        </Box>
      )}
      <Footer items={footerVoices(phraseCustom ? "phrase" : "back")} />
    </Box>
  );
}
