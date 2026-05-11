import { Box, Text } from "ink";
import Spinner from "ink-spinner";

import { semantic } from "~/cli/theme/semantic.js";

export interface LoadingProps {
  message?: string;
}

export function Loading({ message = "Loading..." }: LoadingProps) {
  return (
    <Box>
      <Text color={semantic.accent}>
        <Spinner type="dots" /> {message}
      </Text>
    </Box>
  );
}
