import { Box, Text } from "ink";

export interface LoadingProps {
  message?: string;
}

export function Loading({ message = "Loading..." }: LoadingProps) {
  return (
    <Box>
      <Text color="cyan">{message}</Text>
    </Box>
  );
}
