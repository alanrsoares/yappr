declare module 'cli-highlight' {
  export interface HighlightOptions {
    language?: string;
    ignoreIllegals?: boolean;
    theme?: Record<string, unknown>;
  }
  export function highlight(code: string, options?: HighlightOptions): string;
}
