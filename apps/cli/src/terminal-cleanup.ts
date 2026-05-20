import fs from "node:fs";

/**
 * Best-effort reset of common interactive terminal modes before exit:
 * bracketed paste, mouse tracking, and SGR colour.
 */
const TERMINAL_MODE_RESET =
  "[?2004l" + // bracketed paste off
  "[?1000l[?1002l[?1003l[?1006l" + // mouse off
  "[0m"; // SGR reset

export function cleanupTerminalModesSync(): void {
  try {
    if (process.stdout?.fd === undefined) return;
    fs.writeSync(process.stdout.fd, TERMINAL_MODE_RESET);
  } catch {
    // ignore — process may be tearing down
  }
}
