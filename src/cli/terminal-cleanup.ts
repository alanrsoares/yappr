import fs from "node:fs";

/**
 * Best-effort reset of common interactive terminal modes before exit.
 * Avoids leaving bracketed paste, mouse tracking, or attributes stuck on.
 */
const TERMINAL_CLEANUP_SEQUENCE =
  "\x1b[?2004l" + // bracketed paste off
  "\x1b[?1000l\x1b[?1002l\x1b[?1003l\x1b[?1006l" + // mouse off
  "\x1b[0m"; // SGR reset

export function cleanupTerminalModesSync(): void {
  try {
    if (process.stdout?.fd !== undefined) {
      fs.writeSync(process.stdout.fd, TERMINAL_CLEANUP_SEQUENCE);
      return;
    }
  } catch {
    // ignore — process may be tearing down
  }
}
