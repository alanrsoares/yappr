import { render } from "ink";

import { Root } from "./Root.js";
import { registerSignalHandlers } from "./shutdown-hooks.js";
import {
  cleanupTerminalModesSync,
  enterAlternateScreenSync,
} from "./terminal-cleanup.js";

registerSignalHandlers();
enterAlternateScreenSync();
process.on("exit", () => {
  cleanupTerminalModesSync();
});

render(<Root />);
