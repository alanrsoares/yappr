import fs from "node:fs";

/** xterm-style alternate screen: preserve main-buffer scrollback while the TUI runs. */
const ENTER_ALTERNATE_SCREEN = "\u001B[?1049h";
const LEAVE_ALTERNATE_SCREEN = "\u001B[?1049l";

let alternateScreenActive = false;

/**
 * `YAPPR_ALT_SCREEN=0|false|no|off` disables alternate buffer (broken SSH/tmux).
 * When unset, alternate screen is used on TTY (gemini-cli-style scrollback preservation).
 */
export function alternateScreenAllowedByEnv(): boolean {
  const v = process.env.YAPPR_ALT_SCREEN?.trim().toLowerCase();
  return !(v === "0" || v === "false" || v === "no" || v === "off");
}

/**
 * Switch to the alternate screen buffer before Ink paints (TTY only).
 * Pair with {@link cleanupTerminalModesSync} on exit so scrollback is restored.
 */
export function enterAlternateScreenSync(): void {
  try {
    if (
      !process.stdout.isTTY ||
      process.stdout.fd === undefined ||
      !alternateScreenAllowedByEnv()
    ) {
      return;
    }
    fs.writeSync(process.stdout.fd, ENTER_ALTERNATE_SCREEN);
    alternateScreenActive = true;
  } catch {
    // ignore — non-interactive or teardown
  }
}

/**
 * Best-effort reset of common interactive terminal modes before exit.
 * Leaves alternate screen first, then bracketed paste / mouse / SGR reset.
 */
const AFTER_ALT_BUFFER_CLEANUP =
  "\u001B[?2004l" + // bracketed paste off
  "\u001B[?1000l\u001B[?1002l\u001B[?1003l\u001B[?1006l" + // mouse off
  "\u001B[0m"; // SGR reset

export function cleanupTerminalModesSync(): void {
  try {
    if (process.stdout?.fd === undefined) return;
    let seq = "";
    if (alternateScreenActive) {
      seq += LEAVE_ALTERNATE_SCREEN;
      alternateScreenActive = false;
    }
    seq += AFTER_ALT_BUFFER_CLEANUP;
    fs.writeSync(process.stdout.fd, seq);
  } catch {
    // ignore — process may be tearing down
  }
}
