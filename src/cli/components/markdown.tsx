import { useMemo } from "react";
import { highlight } from "cli-highlight";
import { Text } from "ink";
import { marked, type Renderer } from "marked";
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
  renderer: renderer as unknown as Renderer,
});

export function Markdown({ children }: MarkdownProps) {
  const content = useMemo(() => {
    try {
      return marked.parse(children) as string;
    } catch (_) {
      return children;
    }
  }, [children]);

  return <Text>{content.trimEnd()}</Text>;
}
