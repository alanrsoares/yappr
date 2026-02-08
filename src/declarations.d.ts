declare module 'cli-highlight' {
  export interface HighlightOptions {
    language?: string;
    ignoreIllegals?: boolean;
    theme?: any;
  }
  export function highlight(code: string, options?: HighlightOptions): string;
}
