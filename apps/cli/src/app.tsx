import { render } from "ink";

import { Root } from "./Root.js";
import { registerSignalHandlers } from "./shutdown-hooks.js";
import { cleanupTerminalModesSync } from "./terminal-cleanup.js";

registerSignalHandlers();
process.on("exit", () => {
  cleanupTerminalModesSync();
});

render(<Root />);
