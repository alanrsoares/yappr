import type { ComponentProps } from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";

import { semantic } from "~/cli/theme/semantic.js";

/** Matches ink-spinner / its bundled cli-spinners names (may differ from root `cli-spinners` types). */
export type LoadingSpinnerName = NonNullable<
  ComponentProps<typeof Spinner>["type"]
>;

export interface LoadingProps {
  message?: string;
  /** Spinner variant (see cli-spinners / ink-spinner docs). */
  spinner?: LoadingSpinnerName;
}

export function Loading({
  message = "Loading...",
  spinner = "dots",
}: LoadingProps) {
  return (
    <Box>
      <Text color={semantic.accent}>
        <Spinner type={spinner} /> {message}
      </Text>
    </Box>
  );
}
