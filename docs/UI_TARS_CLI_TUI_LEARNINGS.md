# UI-TARS Agent TARS Learnings for Yappr CLI/TUI

This note captures what is useful for Yappr from a code-level read of
ByteDance UI-TARS Desktop and Agent TARS, with focus on Yappr's Ink CLI/TUI.

The upstream repo was inspected from:

- `https://github.com/bytedance/UI-TARS-desktop`
- Local clone used during review: `/private/tmp/UI-TARS-desktop`

The main goal is not to copy Agent TARS wholesale. Yappr is a local-first voice
assistant with a smaller scope. The useful parts are the architecture patterns:
event stream as source of truth, durable replay, tool lifecycle visibility,
runtime metrics, and debug surfaces.

## Implementation Status

- Phase 1 in-memory CLI events: done.
  - `apps/cli/src/screens/chat/events.ts` defines the typed event union, ID
    helpers, append helper, and selectors for messages, streaming response,
    active tool call, and phase.
  - `apps/cli/src/screens/chat/store.tsx` emits chat, tool, TTS, STT, run, and
    system events while keeping the rendered chat behavior unchanged.
  - `apps/cli/src/screens/chat/events.test.ts` covers core selector behavior.
- Phase 2 `/events` debug view: initial version done.
  - `/events` opens an in-memory current-session event browser inside the chat
    provider, before DB persistence.
  - It supports selection, detail expansion, and filters for messages, tools,
    audio, errors, and system events.
- Phase 3 durable `agent_events`: initial write path done.
  - `packages/db/src/schema.ts` now defines `agent_events` with conversation
    and run indexes.
  - `packages/db/src/repositories/agent-events.ts` appends and lists events by
    conversation or run.
  - CLI chat persists durable events only; streaming token chunks remain
    ephemeral.
  - `/events` hydrates durable events for the current conversation and merges
    them with the live in-memory stream by event id.
  - Cross-session conversation browsing/replay is still pending.
- Phase 4 richer tool lifecycle UI: initial status summary done.
  - CLI status now derives latest-run tool summaries from events and displays
    completed or failed tool calls compactly.
  - Chat-history tool blocks and live elapsed timers are still pending.
- Phase 5 snapshot/replay tests: not started.

## Relevant Upstream Code

Most useful areas in UI-TARS:

- `multimodal/tarko/agent-interface/src/agent-event-stream.ts`
  - Typed event model for user, assistant, streaming, tool, system, plan, and run
    lifecycle events.
- `multimodal/tarko/agent/src/agent/event-stream.ts`
  - In-memory event stream processor with subscribers, filters, initial event
    restore, and trimming.
- `multimodal/tarko/agent/src/agent/message-history.ts`
  - Converts event stream into LLM message history. Events are canonical;
    message history is derived.
- `multimodal/tarko/agent/src/agent/runner/llm-processor.ts`
  - Handles streaming chunks, final assistant events, reasoning events, TTFT,
    TTLT, and message ID correlation.
- `multimodal/tarko/agent/src/agent/runner/tool-processor.ts`
  - Emits tool call and tool result events with arguments, schema, elapsed time,
    and errors.
- `multimodal/tarko/agent-server/src/core/AgentSession.ts`
  - Bridges agent events to clients and persists only durable events.
- `multimodal/tarko/agent-ui/src/common/state/actions/eventProcessors/*`
  - UI reducers that derive messages, tool panels, raw event views, and replay
    state from incoming events.
- `multimodal/tarko/agent-ui/src/standalone/modals/EventStreamModal.tsx`
  - Raw event stream viewer for debugging.
- `packages/agent-infra/mcp-client/src/index.ts`
  - MCP client with server lifecycle, enhanced PATH, timeouts, filters, prompts,
    and multiple transports.
- `multimodal/tarko/agent-snapshot/src/*`
  - Snapshot generation and replay around LLM requests, LLM chunks, event
    streams, and tool calls.

## Current Yappr CLI Shape

Relevant Yappr files:

- `apps/cli/src/screens/chat/store.tsx`
  - Owns transient state: `messages`, `streamingResponse`, `phase`,
    `activeToolCall`, abort controllers, persistence fire-and-forget, STT, TTS.
- `apps/cli/src/screens/chat/components/chat-history.tsx`
  - Renders static messages plus one separate streaming assistant response.
- `apps/cli/src/screens/chat/components/chat-status.tsx`
  - Renders a prioritized status derived from phase, tool, STT, and errors.
- `apps/cli/src/screens/chat/slash-commands.ts`
  - Existing place to add `/events`.
- `apps/cli/src/lib/chat-persistence.ts`
  - Persists user and assistant messages to SQLite through `packages/db`.
- `packages/sdk/src/mcp.ts`
  - MCP manager exposes tools and calls but does not currently produce rich
    lifecycle events.
- `packages/db/src/schema.ts`
  - Current persistence model has `conversations` and `messages`, but no
    append-only agent event table.

The CLI works, but the store mixes four concerns:

1. Runtime execution.
2. UI state.
3. Persistence.
4. Debug observability.

Agent TARS separates those by making the event stream the boundary.

## Main Principle

Yappr CLI should move toward:

```txt
runtime actions -> typed events -> derived Ink state -> rendered TUI
                         |
                         -> durable events in SQLite
                         |
                         -> debug/replay/snapshot tooling
```

Instead of:

```txt
runtime actions -> setMessages/setStreamingResponse/setPhase/setActiveToolCall
                         |
                         -> separate persistence side effects
```

This keeps the TUI thin without making the runtime heavier than needed.

## Event Stream Design for Yappr

Yappr does not need the full Agent TARS event set. Start with a smaller union
that covers chat, tools, STT, TTS, and errors.

Suggested event types:

```ts
type YapprAgentEvent =
  | RunStartEvent
  | RunEndEvent
  | UserMessageEvent
  | AssistantStreamingMessageEvent
  | AssistantMessageEvent
  | ToolCallEvent
  | ToolResultEvent
  | SttStartEvent
  | SttTranscriptEvent
  | SttEndEvent
  | TtsStartEvent
  | TtsEndEvent
  | SystemEvent;
```

Common fields:

```ts
interface BaseEvent {
  id: string;
  conversationId: string | null;
  runId: string;
  type: string;
  timestamp: number;
}
```

Recommended concrete fields:

- `run.start`
  - `provider`, `model`, `voice`, `mcpConfigPath`, `inputKind`.
- `run.end`
  - `status`, `elapsedMs`, `error`.
- `message.user`
  - `content`.
- `message.assistant.streaming`
  - `messageId`, `delta`, `isComplete`.
- `message.assistant`
  - `messageId`, `content`, `finishReason`, `ttftMs`, `ttltMs`.
- `tool.call`
  - `toolCallId`, `name`, `server`, `arguments`, `schema`, `startTime`.
- `tool.result`
  - `toolCallId`, `name`, `content`, `elapsedMs`, `error`.
- `stt.start`
  - `deviceIndex`.
- `stt.transcript`
  - `content`, `elapsedMs`.
- `stt.end`
  - `status`, `error`.
- `tts.start`
  - `voice`, `mode` (`direct` or `narration`), `contentLength`.
- `tts.end`
  - `status`, `elapsedMs`, `error`.
- `system`
  - `level`, `message`, `details`.

Use dot-separated names in Yappr if desired. Agent TARS uses snake_case, but
Yappr can choose one convention and keep it consistent.

## Durable vs Ephemeral Events

Agent TARS stores durable events and drops streaming events for persistence:

- Store final message, tool call/result, run lifecycle, system/error events.
- Do not store every token chunk.

Yappr should follow this.

Persist:

- `run.start`
- `run.end`
- `message.user`
- `message.assistant`
- `tool.call`
- `tool.result`
- `stt.transcript`
- `tts.start`
- `tts.end`
- `system` warnings/errors

Do not persist by default:

- `message.assistant.streaming`
- partial tool call argument deltas, unless debugging is explicitly enabled.

Reason:

- SQLite stays small.
- Replay remains deterministic from final durable events.
- UI can still stream live from ephemeral events.

## Deriving CLI State

Current store fields can become selectors over an event list.

`messages`:

- Build from `message.user` and final `message.assistant`.
- While a streaming assistant message exists, merge deltas by `messageId` into
  a temporary assistant message.

`streamingResponse`:

- Derived from latest active `message.assistant.streaming` events.
- Eventually remove as independent state.

`activeToolCall`:

- Derived from latest `tool.call` without matching `tool.result`.
- Better: derive a list of active and completed tool calls for status/history.

`phase`:

- Derived from event lifecycle:
  - After `run.start`, before assistant/tool/TTS completion: `thinking`.
  - During `tts.start` without `tts.end`: `speaking`.
  - During narration request: `narrating`.
  - During `stt.start` before transcript/end: `recording` or `transcribing`.
  - After `run.end`: `idle`.

`chatError`, `sttError`:

- Derived from `run.end.status === "error"`, `stt.end.error`, or `system`
  error events.

This keeps Ink components unchanged at first. Refactor the data source, not the
whole UI.

## Stable IDs for Streaming

Agent TARS uses `messageId` to connect streaming deltas to the final assistant
message. Yappr should do the same.

Today, CLI has one global `streamingResponse`, which works for one stream, but
it is fragile when adding:

- retries,
- resumed conversations,
- multiple panels,
- debug replay,
- interleaved tool calls,
- desktop/CLI shared runtime.

Recommended pattern:

```txt
runId = unique per submitted prompt
assistantMessageId = unique per assistant response
toolCallId = model/tool ID when available, generated fallback otherwise
```

Streaming deltas append to `assistantMessageId`. Final assistant event replaces
or completes that same message.

## Tool Lifecycle in TUI

Agent TARS makes tool calls first-class. Yappr should make CLI tool display more
informative than `Calling tool: X`.

Suggested TUI display:

```txt
Tools
  github.search       running   0.8s
  filesystem.read     done      12ms
  browser.open        error     3.2s
```

For each tool:

- name,
- server,
- status,
- elapsed time,
- compact args preview,
- error text if failed,
- optional result preview.

In chat history, assistant messages that requested tools can show a compact
tool block under the message. For narrow terminals, keep one line per tool.

Initial CLI implementation can be status-only:

- Show active tool name and elapsed time in `ChatStatus`.
- Add completed tool summary in the message bubble later.

## Timings and Metrics

Agent TARS records:

- TTFT: time to first token.
- TTLT: time to last token.
- tool elapsed time.
- thinking duration.

Yappr CLI should expose:

- model first token latency,
- model total response time,
- tool call latency,
- STT duration,
- TTS synth/playback duration.

Useful status/footer examples:

```txt
Thinking... first token 820ms
Tool github.search running 1.1s
Done model 4.2s | tts 690ms
```

These metrics help debug local Ollama slowness, MCP hangs, Python server
latency, and audio problems.

## `/events` Debug Screen

Agent TARS ships an Event Stream modal. Yappr CLI equivalent should be a screen
opened by slash command:

```txt
/events
```

Suggested UI:

```txt
Event Stream

12:41:22.103  run.start             llama3.2 / ollama
12:41:22.104  message.user          "summarize this repo"
12:41:22.932  message.assistant...  delta 42 chars
12:41:23.210  tool.call             filesystem.list
12:41:23.224  tool.result           filesystem.list 14ms
12:41:26.511  message.assistant     1284 chars  TTFT 828ms TTLT 4.4s
12:41:27.030  tts.end               kokoro 519ms
12:41:27.032  run.end               success 4.9s
```

Controls:

- `j/k` or arrows: move selection.
- `enter`: expand JSON/details.
- `f`: cycle filter.
- `c`: copy selected JSON if clipboard helper exists later.
- `esc`: back to chat.

Filters:

- all,
- messages,
- tools,
- audio,
- errors,
- system.

The first version can be read-only and in-memory for the current conversation.
Persisted event browsing can come after `agent_events` exists.

## Snapshot Tests for CLI Runs

Agent TARS snapshot tooling records:

- LLM request per loop.
- LLM response chunks.
- event stream before/after loops.
- tool calls and results.

Yappr can adapt this at smaller scale.

Snapshot directory shape:

```txt
apps/cli/src/screens/chat/__snapshots__/basic-tool-call/
  request.json
  response-chunks.jsonl
  events.jsonl
  tool-calls.jsonl
```

Use cases:

- tool call regression tests without live MCP servers,
- streaming rendering tests without live Ollama,
- persistence tests for durable events,
- STT/TTS lifecycle tests with mocked services.

This would make CLI behavior testable as a run transcript, not only isolated
message formatting.

## MCP Improvements From UI-TARS

UI-TARS MCP client has several patterns useful for Yappr:

- Enhanced `PATH` for stdio servers.
  - Helps GUI/TUI launches find `npx`, `uvx`, `node`, `python`, `cargo`, etc.
- Per-server timeout.
  - Prevents one hanging MCP call from freezing the chat run.
- Server lifecycle events.
  - `server-started`, `server-stopped`, `server-error`.
- Tool and prompt filtering.
  - Allow/block by glob pattern.
- Prompt listing.
  - Yappr currently focuses on tools; prompt discovery could power future slash
    commands.
- In-memory transport.
  - Useful for built-in local tools and tests.

Yappr-specific additions to `packages/sdk/src/mcp.ts`:

- Add optional `timeoutMs` per server/tool call.
- Emit `tool.call` and `tool.result` events from `callTool`.
- Add enhanced PATH for stdio transport.
- Add allow/block filters to config schema later.

## Ink/TUI Rendering Guidance

Keep the CLI calm and dense. Do not turn it into a dashboard by default.

Default chat view:

- User and assistant messages stay primary.
- Status line shows current phase and one high-signal metric.
- Tool detail stays collapsed unless a tool is running or failed.

Debug view:

- `/events` shows raw detail.
- `/mcp` remains server status.
- Future `/metrics` could summarize timing across current session.

Narrow terminal behavior:

- Use one-line event summaries.
- Truncate content previews with existing string-display helpers.
- Expand selected item only.
- Avoid multi-column layouts when width is low.

## Data Model Proposal

Add to `packages/db/src/schema.ts`:

```sql
CREATE TABLE IF NOT EXISTS agent_events (
  id TEXT PRIMARY KEY,
  conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,
  run_id TEXT NOT NULL,
  type TEXT NOT NULL,
  event_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS idx_agent_events_conv_created
  ON agent_events(conversation_id, created_at);

CREATE INDEX IF NOT EXISTS idx_agent_events_run_created
  ON agent_events(run_id, created_at);
```

Why store full JSON:

- Event shapes evolve faster than messages.
- SQLite remains simple.
- Query needs are mostly by conversation/run/time.
- Derived views can come later.

Keep `messages` table for compatibility and fast sidebar/history rendering.
Longer term, messages can become a projection of events, but no need to force
that migration now.

## Suggested Implementation Plan

### Phase 1: In-memory events in CLI

- Add event union and event stream helper under `apps/cli/src/screens/chat/` or
  a shared package if desktop will consume immediately.
- Emit events in `store.tsx`.
- Keep existing `messages`, `streamingResponse`, and `phase`, but set them from
  event reducers/selectors.
- Add `runId` and assistant `messageId`.

Outcome:

- No DB migration yet.
- Low risk.
- CLI behavior should remain the same.

### Phase 2: `/events` screen

- Add `events` screen under `apps/cli/src/screens/events/`.
- Add slash command in `chat/slash-commands.ts`.
- Show current conversation/run event list.
- Support filtering and JSON expansion.

Outcome:

- Immediate debugging value.
- Validates event shape before persistence.

### Phase 3: Durable event persistence

- Add `agent_events` table and repo in `packages/db`.
- Add RPC methods for desktop compatibility.
- Persist only durable events.
- Load events when opening a conversation.

Outcome:

- Replay/debug survives app restart.
- Desktop can share same event model.

### Phase 4: Tool lifecycle UI

- Update `ChatStatus` and `ChatHistory` to show tool calls/results.
- Add elapsed timers for active tools.
- Show failed tool results prominently but compactly.

Outcome:

- MCP behavior becomes inspectable in TUI.

### Phase 5: Snapshot tests

- Add test harness to record/replay:
  - LLM chunks,
  - tool calls,
  - durable events.
- Convert existing chat tests or add new run-level tests.

Outcome:

- Regression protection for streaming, tools, and persistence.

## Non-Goals

Do not copy these UI-TARS pieces into Yappr CLI now:

- full browser automation stack,
- Agent TARS server architecture,
- web UI replay controls,
- sandbox allocation,
- multi-agent planning UI,
- AGIO/cloud monitoring.

They solve a larger product. Yappr should take the small, durable runtime
patterns only.

## Risks and Guardrails

- Risk: event model becomes too abstract.
  - Guardrail: start with concrete Yappr events only: chat, tool, STT, TTS.
- Risk: double source of truth with `messages` and `agent_events`.
  - Guardrail: treat `messages` as compatibility projection. New logic should
    prefer events.
- Risk: persisting token chunks bloats DB.
  - Guardrail: never persist streaming chunks unless explicit debug mode.
- Risk: CLI becomes noisy.
  - Guardrail: default view stays simple; details live in `/events`.
- Risk: MCP result content is huge.
  - Guardrail: truncate previews in UI, store full event JSON only for durable
    result events, consider size limits later.

## Recommended First Patch

Most pragmatic first patch:

1. Add `apps/cli/src/screens/chat/events.ts`.
2. Define `YapprAgentEvent`, `createEvent`, and reducer helpers.
3. Refactor `store.tsx` to emit:
   - `run.start`
   - `message.user`
   - `message.assistant.streaming`
   - `tool.call`
   - `tool.result`
   - `message.assistant`
   - `tts.start`
   - `tts.end`
   - `run.end`
   - `system` errors
4. Keep UI output unchanged.
5. Add tests for reducer behavior.

Then add `/events`.
