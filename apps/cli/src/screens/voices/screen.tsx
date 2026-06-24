import { Box, Text } from "ink";

import { Footer, Header, Loading } from "~/components";
import { footerVoices } from "~/footer-items.js";
import { listSelectionPrefix } from "~/list-selection-prefix.js";
import { semantic } from "~/theme/semantic.js";
import { useVoicesController, type VoicePreviewStatus } from "./store.js";

export interface VoicesScreenProps {
  onBack: () => void;
}

interface VoicesPreviewStatusLineProps {
  status: VoicePreviewStatus;
  previewError: string | null;
}

function VoicesPreviewStatusLine({
  status,
  previewError,
}: VoicesPreviewStatusLineProps) {
  if (status === "loading") return <Text dimColor>Synthesizing…</Text>;
  if (status === "error" && previewError)
    return <Text color={semantic.error}>{previewError}</Text>;
  if (status === "ok") return <Text color={semantic.success}>Playing.</Text>;
  return null;
}

const EmptyVoicesMessage = ({ voices }: { voices: readonly string[] }) =>
  voices.length === 0 ? (
    <Text dimColor>No voices returned.</Text>
  ) : (
    <Text dimColor>No voices match filter.</Text>
  );

export function VoicesScreen({ onBack }: VoicesScreenProps) {
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
  } = useVoicesController({ onBack });

  let content = (
    <Box flexDirection="column" marginTop={1}>
      {phraseCustom ? (
        <Box flexDirection="column" marginBottom={1}>
          <Text dimColor>
            Preview phrase (↑/↓ change voice). Enter plays, Esc leaves phrase
            mode, Ctrl+e closes editor.
          </Text>
          <Text>{phrase}</Text>
        </Box>
      ) : (
        <Text dimColor>
          Ctrl+p fixed sample · Ctrl+e type your own · Enter plays sample for
          selection
        </Text>
      )}
      <Box marginTop={phraseCustom ? 0 : 1}>
        <Text dimColor>Filter: </Text>
        <Text>{filterText || "(type to filter)"}</Text>
      </Box>
      <VoicesPreviewStatusLine
        status={previewStatus}
        previewError={previewError}
      />
      <Box flexDirection="column" marginTop={1}>
        {filtered.map((v, i) => (
          <Text
            key={v}
            color={i === effectiveIndex ? semantic.accent : undefined}
          >
            {listSelectionPrefix(i === effectiveIndex)}
            {v}
          </Text>
        ))}
      </Box>
    </Box>
  );
  if (isLoading) {
    content = <Loading message="Loading voices..." />;
  } else if (error) {
    content = <Text color={semantic.error}>{error.message}</Text>;
  } else if (len === 0) {
    content = <EmptyVoicesMessage voices={voices} />;
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Header
        title="Voices"
        subtitle="TTS from server — ↑/↓ select · Ctrl+p sample · Ctrl+e custom phrase · Enter play"
      />
      {content}
      <Footer items={footerVoices(phraseCustom ? "phrase" : "back")} />
    </Box>
  );
}
