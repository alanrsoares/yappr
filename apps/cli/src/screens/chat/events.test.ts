import { describe, expect, test } from "bun:test";

import {
  type ChatEvent,
  createChatEvent,
  deriveActiveToolCall,
  deriveChatPhase,
  deriveLatestRunToolSummaries,
  deriveMessages,
  deriveStreamingResponse,
  mergeChatEvents,
} from "./events.js";

const base = {
  runId: "run_1",
  conversationId: "conv_1",
} as const;

describe("chat events", () => {
  test("derives messages and streaming response by message id", () => {
    const events: ChatEvent[] = [
      createChatEvent({
        ...base,
        type: "message.user",
        content: "hello",
      }),
      createChatEvent({
        ...base,
        type: "message.assistant.streaming",
        messageId: "msg_1",
        delta: "hel",
        isComplete: false,
      }),
      createChatEvent({
        ...base,
        type: "message.assistant.streaming",
        messageId: "msg_1",
        delta: "lo",
        isComplete: false,
      }),
    ];

    expect(deriveMessages(events)).toEqual([
      { role: "user", content: "hello" },
    ]);
    expect(deriveStreamingResponse(events)).toBe("hello");

    events.push(
      createChatEvent({
        ...base,
        type: "message.assistant",
        messageId: "msg_1",
        content: "hello",
        finishReason: "stop",
      }),
    );

    expect(deriveMessages(events)).toEqual([
      { role: "user", content: "hello" },
      { role: "assistant", content: "hello" },
    ]);
    expect(deriveStreamingResponse(events)).toBe("");
  });

  test("isReplace streaming event resets accumulated content", () => {
    const events: ChatEvent[] = [
      createChatEvent({
        ...base,
        type: "message.assistant.streaming",
        messageId: "msg_1",
        delta: "partial reply",
        isComplete: false,
      }),
      createChatEvent({
        ...base,
        type: "message.assistant.streaming",
        messageId: "msg_1",
        delta: "totally different start",
        isComplete: false,
        isReplace: true,
      }),
    ];

    expect(deriveStreamingResponse(events)).toBe("totally different start");

    events.push(
      createChatEvent({
        ...base,
        type: "message.assistant.streaming",
        messageId: "msg_1",
        delta: " continued",
        isComplete: false,
      }),
    );

    expect(deriveStreamingResponse(events)).toBe(
      "totally different start continued",
    );
  });

  test("derives active tool from unmatched call/result events", () => {
    const first = "tool_1";
    const second = "tool_2";
    const events: ChatEvent[] = [
      createChatEvent({
        ...base,
        type: "tool.call",
        toolCallId: first,
        name: "search",
        startTime: 1,
      }),
      createChatEvent({
        ...base,
        type: "tool.call",
        toolCallId: second,
        name: "read_file",
        startTime: 2,
      }),
      createChatEvent({
        ...base,
        type: "tool.result",
        toolCallId: second,
        name: "read_file",
        elapsedMs: 12,
      }),
    ];

    expect(deriveActiveToolCall(events)).toBe("search");

    events.push(
      createChatEvent({
        ...base,
        type: "tool.result",
        toolCallId: first,
        name: "search",
        elapsedMs: 20,
      }),
    );

    expect(deriveActiveToolCall(events)).toBeNull();
  });

  test("derives latest run tool summaries", () => {
    const events: ChatEvent[] = [
      createChatEvent({
        type: "run.start",
        runId: "run_old",
        conversationId: null,
        provider: "ollama",
        model: "old",
        voice: "af",
        mcpConfigPath: "",
      }),
      createChatEvent({
        type: "tool.call",
        runId: "run_old",
        conversationId: null,
        toolCallId: "old_tool",
        name: "old.search",
        startTime: 1,
      }),
      createChatEvent({
        type: "run.start",
        runId: "run_new",
        conversationId: null,
        provider: "ollama",
        model: "new",
        voice: "af",
        mcpConfigPath: "",
      }),
      createChatEvent({
        type: "tool.call",
        runId: "run_new",
        conversationId: null,
        toolCallId: "new_tool",
        name: "repo.read",
        startTime: 2,
      }),
      createChatEvent({
        type: "tool.result",
        runId: "run_new",
        conversationId: null,
        toolCallId: "new_tool",
        name: "repo.read",
        elapsedMs: 14,
      }),
    ];

    expect(deriveLatestRunToolSummaries(events)).toEqual([
      {
        toolCallId: "new_tool",
        name: "repo.read",
        status: "done",
        elapsedMs: 14,
      },
    ]);
  });

  test("merges persisted and local events by id in timestamp order", () => {
    const persisted = createChatEvent({
      ...base,
      type: "message.user",
      content: "hi",
    });
    const duplicateLocal = { ...persisted, content: "hi local" };
    const local = createChatEvent({
      ...base,
      type: "message.assistant.streaming",
      messageId: "msg_1",
      delta: "hello",
      isComplete: false,
    });

    expect(mergeChatEvents([local, duplicateLocal], [persisted])).toEqual([
      duplicateLocal,
      local,
    ]);
  });

  test("derives chat phase from latest lifecycle event", () => {
    const events: ChatEvent[] = [
      createChatEvent({
        ...base,
        type: "run.start",
        provider: "ollama",
        model: "llama",
        voice: "af_heart",
        mcpConfigPath: "/tmp/mcp.json",
      }),
    ];

    expect(deriveChatPhase(events)).toBe("thinking");

    events.push(
      createChatEvent({
        ...base,
        type: "tts.start",
        voice: "af_heart",
        mode: "direct",
        contentLength: 10,
      }),
    );
    expect(deriveChatPhase(events)).toBe("speaking");

    events.push(
      createChatEvent({
        ...base,
        type: "tts.end",
        status: "success",
        elapsedMs: 42,
      }),
    );
    expect(deriveChatPhase(events)).toBe("idle");
  });
});
