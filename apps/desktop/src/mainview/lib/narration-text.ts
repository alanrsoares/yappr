import { marked, type Token, type Tokens } from "marked";

const joinParts = (parts: string[]): string =>
  parts
    .filter(Boolean)
    .join(" ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

function inlineTokensToSpeech(tokens: readonly Token[] = []): string {
  return joinParts(
    tokens.map((token) => {
      switch (token.type) {
        case "text":
        case "escape":
          return "tokens" in token && token.tokens
            ? inlineTokensToSpeech(token.tokens)
            : token.text;
        case "strong":
        case "em":
        case "del":
        case "link":
          return inlineTokensToSpeech(token.tokens ?? []);
        case "codespan":
          return `code ${token.text}`;
        case "br":
          return "\n";
        case "image":
          return token.text ? `image: ${token.text}` : "image";
        default:
          return "";
      }
    }),
  );
}

function blockTokenToSpeech(token: Token): string {
  switch (token.type) {
    case "space":
      return "";
    case "heading":
      return inlineTokensToSpeech(token.tokens ?? []);
    case "paragraph":
      return inlineTokensToSpeech(token.tokens ?? []);
    case "blockquote":
      return joinParts((token.tokens ?? []).map(blockTokenToSpeech));
    case "list":
      return joinParts(
        token.items.map((item: Tokens.ListItem, index: number) => {
          const body = joinParts((item.tokens ?? []).map(blockTokenToSpeech));
          return body ? `Item ${index + 1}. ${body}` : "";
        }),
      );
    case "code": {
      const language = token.lang ? `${token.lang} ` : "";
      return `${language}code block omitted`;
    }
    case "table": {
      const header = token.header
        .map((cell: Tokens.TableCell) =>
          inlineTokensToSpeech(cell.tokens ?? []),
        )
        .filter(Boolean)
        .join(", ");
      return header ? `Table with columns: ${header}` : "Table omitted";
    }
    case "hr":
      return "";
    default:
      return "text" in token && typeof token.text === "string"
        ? token.text
        : "";
  }
}

export const markdownToNarrationText = (markdown: string): string => {
  const tokens = marked.lexer(markdown, { gfm: true });
  const spoken = joinParts(tokens.map(blockTokenToSpeech));
  return spoken || markdown.trim();
};
