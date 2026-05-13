import { describe, expect, test } from "bun:test";

import { McpConfigSchema, McpServerConfigSchema } from "./schemas.js";

describe("McpServerConfigSchema", () => {
  test("accepts a stdio server with optional timeoutMs", () => {
    const parsed = McpServerConfigSchema.parse({
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
      timeoutMs: 5000,
    });
    expect(parsed.timeoutMs).toBe(5000);
  });

  test("allows config without timeoutMs", () => {
    const parsed = McpServerConfigSchema.parse({
      url: "http://localhost:9000",
    });
    expect(parsed.timeoutMs).toBeUndefined();
  });

  test("rejects non-positive timeoutMs", () => {
    expect(() =>
      McpServerConfigSchema.parse({ command: "x", timeoutMs: 0 }),
    ).toThrow();
    expect(() =>
      McpServerConfigSchema.parse({ command: "x", timeoutMs: -1 }),
    ).toThrow();
  });

  test("rejects non-integer timeoutMs", () => {
    expect(() =>
      McpServerConfigSchema.parse({ command: "x", timeoutMs: 1.5 }),
    ).toThrow();
  });
});

describe("McpConfigSchema", () => {
  test("parses a multi-server config", () => {
    const parsed = McpConfigSchema.parse({
      mcpServers: {
        fs: { command: "npx", args: ["-y", "fs-server"] },
        gh: { url: "https://gh.example", timeoutMs: 10_000 },
      },
    });
    expect(Object.keys(parsed.mcpServers)).toEqual(["fs", "gh"]);
    expect(parsed.mcpServers.gh?.timeoutMs).toBe(10_000);
  });

  test("rejects missing mcpServers", () => {
    expect(() => McpConfigSchema.parse({})).toThrow();
  });
});
