import { Box, Text } from "ink";
import Spinner from "ink-spinner";

export interface LoadingProps {
  message?: string;
}

export function Loading({ message = "Loading..." }: LoadingProps) {
  return (
    <Box>
      <Text color="cyan">
        <Spinner type="dots" /> {message}
      </Text>
    </Box>
  );
}
