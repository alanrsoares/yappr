# TUI library exploration

Options for rich terminal UI in yappr (tables, prompts, live updates, keyboard input).

## Options

### 1. **Ink** (React for CLI) — recommended to try first

- **What it is:** React renderer for the terminal. Same mental model as React (components, state, hooks).
- **Pros:** Familiar if you know React; Flexbox layouts; `useInput` for keys; large ecosystem (e.g. `ink-table`, `ink-select-input`, `@clack/prompts` can complement it); used by Wrangler, Gatsby, many CLIs.
- **Cons:** Adds React + Ink as dependencies; some Bun edge cases (e.g. stdin with `useInput` has had fixes).
- **Bun:** Works; see [bun-ink-demo](https://github.com/mieszkogulinski/bun-ink-demo). Run with `bun run` as usual.

**Install:** `bun add ink react` (and optionally `ink-table` for tables).

### 2. **Blessed / bblessed**

- **What it is:** Imperative, widget-based TUI (boxes, lists, forms, mouse support). **bblessed** is a fork tuned for Bun.
- **Pros:** Very full-featured (forms, focus, mouse, layout); no React.
- **Cons:** Steeper learning curve; API is callback/imperative; less “component” reuse.
- **Bun:** Use **bblessed** for Blessed-style API on Bun.

**Install:** `bun add bblessed` (or `blessed` on Node).

### 3. **Lighter-weight / mixed**

- **@clack/prompts:** Select, confirm, text input, spinners. No full-screen TUI; good for wizard-style flows.
- **chalk + manual:** Keep current approach but add colors and simple formatting without a full TUI stack.

## Suggested path for yappr

1. **Try Ink** with a small screen (e.g. MCP status table + “Press q to quit”). See `src/cli/mcp-status.tsx` and run with `bun run tui` (after installing deps).
2. If you like it: gradually move status table and other CLI output into Ink components; add `useInput` for key handling and optional `ink-table` for tables.
3. If you prefer minimal deps: keep current table renderer and add **@clack/prompts** only where you want interactive prompts (e.g. voice selection, confirm before action).

## Running the TUI

In a **real terminal** (not piped stdin). First time: `bun add ink react` if you haven’t already.

```bash
bun run tui
```

This starts the MCP status TUI. Press **q** or **Esc** to quit, **r** to refresh. If you see "Raw mode is not supported", run the command directly in your terminal (e.g. don’t pipe into it). No changes to the main CLI until you decide to adopt Ink.
