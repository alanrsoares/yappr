I have successfully refactored the Chat UI to utilize `ink`'s `Static` component for efficient history rendering, improved the visual design of message bubbles and the input area, and optimized the overall layout by replacing the large header with a compact status bar. The changes have been verified with a type check and committed to the repository.

Refactored the Chat UI to be more efficient and visually cleaner, inspired by the Gemini CLI TUI.

**Key Changes:**
*   **Performance:** Switched `ChatHistory` to use `ink`'s `<Static>` component. This ensures past messages are written to the terminal history rather than being re-rendered constantly, significantly improving performance and providing a native shell feel.
*   **Visuals:**
    *   **Message Bubbles:** Updated to use round borders and a cleaner layout with the sender label distinct from the message content.
    *   **Input Area:** Added a distinct border to the chat input to visually separate it from the conversation history.
*   **Layout:**
    *   Removed the large persistent `Header` to maximize vertical space for the chat.
    *   Added a compact **Status/Info Bar** between the history and the input area to display the current model/provider and active status (e.g., "Thinking...", "Recording...").
    *   Optimized padding and spacing for a polished look.

These changes provide a more robust and professional CLI chat experience.