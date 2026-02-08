I have successfully added syntax highlighting to the Chat UI using `cli-highlight` and improved the loading states with `ink-spinner`.

**Summary of Changes:**
*   **Syntax Highlighting:** Integrated `cli-highlight` into `MessageBubble` to automatically colorize code blocks in AI responses.
*   **Loading Spinner:** Replaced the static "Thinking..." text with an animated dots spinner using `ink-spinner` for a more responsive feel.
*   **Type Safety:** Created `src/declarations.d.ts` to handle missing types for `cli-highlight`.

The Chat UI now features:
1.  **Cleaner Layout:** No large header, distinct status bar.
2.  **Rich Text:** Markdown rendering with syntax highlighting.
3.  **Responsive Feedback:** Animated spinners and real-time streaming updates.
4.  **Native Feel:** `Static` history rendering for efficient terminal usage.