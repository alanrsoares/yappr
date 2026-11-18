import { Box, Text } from "ink";

import { Loading, ScreenShell } from "~/components";
import { footerVoices } from "~/footer-items.js";
import { useTerminalHeight } from "~/hooks";
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
  if (status === "ok") return <Text color={semantic.success}>✓ Playing.</Text>;
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
  const terminalHeight = useTerminalHeight();

  const maxVisible = Math.max(4, terminalHeight - (phraseCustom ? 15 : 11));
  const windowStart =
    len <= maxVisible
      ? 0
      : Math.min(
          Math.max(0, effectiveIndex - Math.floor(maxVisible / 2)),
          len - maxVisible,
        );
  const visible = filtered.slice(windowStart, windowStart + maxVisible);

  let content = (
    <Box flexDirection="column">
      {phraseCustom && (
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor={semantic.border.composer}
          paddingX={1}
          marginBottom={1}
        >
          <Text dimColor>Custom preview phrase:</Text>
          <Text>{phrase}</Text>
        </Box>
      )}
      <Box>
        <Text dimColor>Filter: </Text>
        <Text
          color={filterText ? semantic.accent : undefined}
          dimColor={!filterText}
        >
          {filterText || "(type to filter)"}
        </Text>
      </Box>
      <VoicesPreviewStatusLine
        status={previewStatus}
        previewError={previewError}
      />
      <Box flexDirection="column" marginTop={1}>
        {visible.map((v, i) => {
          const idx = windowStart + i;
          const selected = idx === effectiveIndex;
          return (
            <Text
              key={v}
              color={selected ? semantic.accent : undefined}
              bold={selected}
            >
              {listSelectionPrefix(selected)}
              {v}
            </Text>
          );
        })}
        {len > maxVisible && (
          <Text dimColor>
            Showing {windowStart + 1}–{windowStart + visible.length} of {len}
          </Text>
        )}
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

  const badge =
    voices.length > 0 ? `${filtered.length}/${voices.length}` : undefined;

  return (
    <ScreenShell
      title="Voices"
      badge={badge}
      subtitle="TTS voices from server"
      footerItems={footerVoices(phraseCustom ? "phrase" : "back")}
    >
      {content}
    </ScreenShell>
  );
}
