import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import type { ComponentProps } from "react";

import { semantic } from "~/theme/semantic.js";

/** Matches ink-spinner / its bundled cli-spinners names (may differ from root `cli-spinners` types). */
export type LoadingSpinnerName = NonNullable<
  ComponentProps<typeof Spinner>["type"]
>;

export interface LoadingProps {
  message?: string;
  /** Spinner variant (see cli-spinners / ink-spinner docs). */
  spinner?: LoadingSpinnerName;
}

export const Loading = ({
  message = "Loading...",
  spinner = "dots",
}: LoadingProps) => (
  <Box>
    <Text color={semantic.accent}>
      <Spinner type={spinner} /> {message}
    </Text>
  </Box>
);
