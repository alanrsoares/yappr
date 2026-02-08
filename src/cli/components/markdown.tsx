import { useMemo } from "react";
import { highlight } from "cli-highlight";
import { Text } from "ink";
import { marked } from "marked";
import TerminalRenderer from "marked-terminal";

export interface MarkdownProps {
  children: string;
}

// Initialize the renderer once
const renderer = new TerminalRenderer({
  code: (code: string, lang?: string) => {
    const language = lang && lang.trim() ? lang.trim() : undefined;
    try {
      return highlight(code, { language, ignoreIllegals: true });
    } catch {
      return code;
    }
  },
});

marked.setOptions({
  renderer: renderer as any,
});

export function Markdown({ children }: MarkdownProps) {
  const content = useMemo(() => {
    try {
      return marked.parse(children) as string;
    } catch (e) {
      return children;
    }
  }, [children]);

  return <Text>{content.trimEnd()}</Text>;
}
