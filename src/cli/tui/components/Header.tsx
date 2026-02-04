import React from "react";
import { Box, Text } from "ink";

export interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  return (
    <Box marginBottom={1} flexDirection="column">
      <Text bold color="cyan">
        {title}
      </Text>
      {subtitle !== undefined && (
        <Text dimColor>{subtitle}</Text>
      )}
    </Box>
  );
}
