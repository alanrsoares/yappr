import { describe, expect, test } from "bun:test";

import { createDb } from "../client.js";

describe("agentEvents repo", () => {
  test("appends and lists durable events by conversation and run", () => {
    const db = createDb({ path: ":memory:" });
    const conversation = db.conversations.create({
      title: "hello",
      model: "test-model",
    });
    const event = {
      id: "evt_1",
      conversationId: conversation.id,
      runId: "run_1",
      type: "message.user",
      eventJson: JSON.stringify({ type: "message.user", content: "hello" }),
      createdAt: 123,
    };

    db.agentEvents.append(event);

    expect(db.agentEvents.listForConversation(conversation.id)).toEqual([
      event,
    ]);
    expect(db.agentEvents.listForRun("run_1")).toEqual([event]);
    db.close();
  });

  test("cascades event deletion with conversations", () => {
    const db = createDb({ path: ":memory:" });
    const conversation = db.conversations.create({
      title: "hello",
      model: "test-model",
    });

    db.agentEvents.append({
      id: "evt_1",
      conversationId: conversation.id,
      runId: "run_1",
      type: "run.start",
      eventJson: JSON.stringify({ type: "run.start" }),
      createdAt: 123,
    });
    db.conversations.delete(conversation.id);

    expect(db.agentEvents.listForConversation(conversation.id)).toEqual([]);
    db.close();
  });
});
