import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import {
  StreamableHTTPClientTransport,
  StreamableHTTPError,
} from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type {
  CallToolResult,
  Tool as McpTool,
} from "@modelcontextprotocol/sdk/types.js";
import { type SchemaInput, type Tool, toolDefinition } from "@tanstack/ai";
import { Data, Effect } from "effect";
import type { Tool as OllamaTool } from "ollama";

import { resolveMcpConfigPath } from "./paths.js";
import { McpConfigSchema } from "./schemas.js";
import type { McpServerConfig, ServerStatus, TransportKind } from "./types.js";

export type McpLifecycleEvent =
  | { type: "server.connecting"; serverId: string; transport?: TransportKind }
  | {
      type: "server.connected";
      serverId: string;
      transport: TransportKind;
      toolCount: number;
      elapsedMs: number;
    }
  | {
      type: "server.error";
      serverId: string;
      phase: "connect" | "list-tools" | "call-tool";
      error: string;
      toolName?: string;
    }
  | { type: "server.disconnected"; serverId: string }
  | {
      type: "tool.call.timeout";
      serverId: string;
      toolName: string;
      timeoutMs: number;
    };

export interface McpManagerOptions {
  /** Default timeout (ms) for tool calls when a server config doesn't specify one. */
  defaultTimeoutMs?: number;
  /** Fire-and-forget lifecycle callback. Synchronous; do not throw. */
  onEvent?: (event: McpLifecycleEvent) => void;
}

const DEFAULT_TOOL_CALL_TIMEOUT_MS = 30_000;

/** Failure loading MCP config or calling an MCP tool. */
export class McpError extends Data.TaggedError("McpError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

const toMcpError = (cause: unknown): McpError =>
  new McpError({
    message: cause instanceof Error ? cause.message : String(cause),
    cause,
  });

export class McpManager {
  private clients: Map<string, Client> = new Map();
  private tools: Map<string, { server: string; tool: McpTool }> = new Map();
  private serverTimeouts: Map<string, number> = new Map();
  private readonly defaultTimeoutMs: number;
  private readonly onEvent: (event: McpLifecycleEvent) => void;

  constructor(options: McpManagerOptions = {}) {
    this.defaultTimeoutMs =
      options.defaultTimeoutMs ?? DEFAULT_TOOL_CALL_TIMEOUT_MS;
    this.onEvent = options.onEvent ?? (() => {});
  }

  private emit(event: McpLifecycleEvent): void {
    try {
      this.onEvent(event);
    } catch (error) {
      console.warn("[yappr] mcp onEvent threw:", error);
    }
  }

  private resolveTimeoutMs(serverId: string): number {
    return this.serverTimeouts.get(serverId) ?? this.defaultTimeoutMs;
  }

  loadConfigAndGetStatuses(
    configPath: string = resolveMcpConfigPath(),
  ): Effect.Effect<ServerStatus[], McpError> {
    return Effect.gen(this, function* () {
      const content = yield* Effect.tryPromise({
        try: async () => {
          const file = Bun.file(configPath);
          return (await file.exists()) ? await file.text() : null;
        },
        catch: toMcpError,
      });
      if (content === null) return [];
      const parsed = yield* Effect.try({
        try: () => McpConfigSchema.safeParse(JSON.parse(content)),
        catch: toMcpError,
      });
      if (!parsed.success) {
        return yield* Effect.fail(
          new McpError({
            message: `Invalid MCP config: ${parsed.error.message}`,
          }),
        );
      }
      return yield* Effect.promise(() =>
        this.connectAll(parsed.data.mcpServers),
      );
    });
  }

  private async connectAll(
    servers: Record<string, McpServerConfig>,
  ): Promise<ServerStatus[]> {
    const results: ServerStatus[] = [];
    for (const [id, serverConfig] of Object.entries(servers)) {
      results.push(await this.connectToServer(id, serverConfig));
    }
    return results;
  }

  /** True when Streamable HTTP failed with 4xx — retry with SSE. */
  private isStreamableHttpUnsupported(error: unknown): boolean {
    if (error instanceof StreamableHTTPError && error.code !== undefined) {
      const code = error.code;
      return code >= 400 && code < 500;
    }
    return false;
  }

  private async connectToServer(
    id: string,
    config: McpServerConfig,
  ): Promise<ServerStatus> {
    if (config.timeoutMs !== undefined) {
      this.serverTimeouts.set(id, config.timeoutMs);
    }
    try {
      if (config.command) {
        this.emit({
          type: "server.connecting",
          serverId: id,
          transport: "stdio",
        });
        return await this.connectWithStdio(id, config);
      }
      if (config.url) {
        this.emit({ type: "server.connecting", serverId: id });
        return await this.connectWithUrl(id, config.url);
      }
      return {
        id,
        status: "[SKIP] Skipped",
        tools: 0,
        message: "No command/url",
      };
    } catch (error: unknown) {
      let msg = error instanceof Error ? error.message : "Unknown error";
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        msg = "Command not found";
      } else if (msg.includes("Non-200")) {
        msg = "Auth/Connection Err";
      }
      this.emit({
        type: "server.error",
        serverId: id,
        phase: "connect",
        error: msg,
      });
      return { id, status: "[FAIL] Failed", tools: 0, message: msg };
    }
  }

  private async connectWithStdio(
    id: string,
    config: McpServerConfig,
  ): Promise<ServerStatus> {
    const env: Record<string, string> = {};
    const combinedEnv = { ...process.env, ...config.env };
    for (const [key, value] of Object.entries(combinedEnv)) {
      if (value !== undefined) env[key] = value;
    }
    const transport = new StdioClientTransport({
      command: config.command!,
      args: config.args || [],
      env,
      stderr: "ignore",
    });
    const client = new Client(
      { name: "yappr-client", version: "1.0.0" },
      { capabilities: {} },
    );
    await client.connect(transport);
    this.clients.set(id, client);
    return this.registerToolsAndReturnStatus(id, client, "stdio");
  }

  /** URL: Streamable HTTP first, then SSE fallback. */
  private async connectWithUrl(
    id: string,
    urlStr: string,
  ): Promise<ServerStatus> {
    const url = new URL(urlStr);

    try {
      const transport = new StreamableHTTPClientTransport(url);
      const client = new Client(
        { name: "yappr-client", version: "1.0.0" },
        { capabilities: {} },
      );
      await client.connect(transport);
      this.clients.set(id, client);
      return this.registerToolsAndReturnStatus(id, client, "streamable-http");
    } catch (firstError) {
      if (!this.isStreamableHttpUnsupported(firstError)) {
        throw firstError;
      }
      const transport = new SSEClientTransport(url, { eventSourceInit: {} });
      const client = new Client(
        { name: "yappr-client", version: "1.0.0" },
        { capabilities: {} },
      );
      await client.connect(transport);
      this.clients.set(id, client);
      return this.registerToolsAndReturnStatus(id, client, "sse");
    }
  }

  private async registerToolsAndReturnStatus(
    id: string,
    client: Client,
    transport: TransportKind,
  ): Promise<ServerStatus> {
    const startedAt = Date.now();
    let result: Awaited<ReturnType<typeof client.listTools>>;
    try {
      result = await client.listTools();
    } catch (error) {
      this.emit({
        type: "server.error",
        serverId: id,
        phase: "list-tools",
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
    const toolCount = result.tools?.length ?? 0;
    if (result.tools) {
      for (const tool of result.tools) {
        this.tools.set(tool.name, { server: id, tool });
      }
    }
    this.emit({
      type: "server.connected",
      serverId: id,
      transport,
      toolCount,
      elapsedMs: Date.now() - startedAt,
    });
    return {
      id,
      status: "[OK] Connected",
      tools: toolCount,
      message: "Ready",
      transport,
    };
  }

  getOllamaTools(): OllamaTool[] {
    return [...this.tools.values()].map(({ tool }) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }));
  }

  getTanStackTools(): Array<Tool<SchemaInput, SchemaInput>> {
    return [...this.tools.values()].map(({ tool }) => {
      const def = toolDefinition({
        name: tool.name,
        description: tool.description || "",
        inputSchema: tool.inputSchema as SchemaInput,
      });

      return def.server(async (args: unknown) => {
        // runPromise rejects with the McpError on failure, which def.server
        // surfaces as a tool error — same contract as the old Err throw.
        const result = await Effect.runPromise(
          this.callTool(tool.name, args as Record<string, unknown>),
        );
        return result.content;
      });
    });
  }

  callTool(
    name: string,
    args: Record<string, unknown>,
  ): Effect.Effect<CallToolResult, McpError> {
    const entry = this.tools.get(name);
    if (!entry) {
      return Effect.fail(new McpError({ message: `Tool ${name} not found` }));
    }

    const { server } = entry;
    const client = this.clients.get(server);
    if (!client) {
      return Effect.fail(
        new McpError({
          message: `Server ${server} for tool ${name} is not connected`,
        }),
      );
    }

    const timeoutMs = this.resolveTimeoutMs(server);
    return Effect.gen(this, function* () {
      const ac = new AbortController();
      const timer = setTimeout(() => {
        ac.abort(
          new Error(
            `MCP tool '${name}' on server '${server}' timed out after ${timeoutMs}ms`,
          ),
        );
      }, timeoutMs);

      console.log(`Calling MCP tool '${name}' on server '${server}'...`);
      return yield* Effect.tryPromise({
        try: () =>
          client.callTool({ name, arguments: args }, undefined, {
            signal: ac.signal,
            timeout: timeoutMs,
          }) as Promise<CallToolResult>,
        catch: (err) => {
          const reason =
            ac.signal.aborted && ac.signal.reason instanceof Error
              ? ac.signal.reason
              : err;
          if (ac.signal.aborted) {
            this.emit({
              type: "tool.call.timeout",
              serverId: server,
              toolName: name,
              timeoutMs,
            });
          } else {
            this.emit({
              type: "server.error",
              serverId: server,
              phase: "call-tool",
              error: reason instanceof Error ? reason.message : String(reason),
              toolName: name,
            });
          }
          return toMcpError(reason);
        },
      }).pipe(Effect.ensuring(Effect.sync(() => clearTimeout(timer))));
    });
  }

  async close(): Promise<void> {
    for (const [id, client] of this.clients.entries()) {
      try {
        await client.close();
      } catch {
        /* ignore */
      }
      this.emit({ type: "server.disconnected", serverId: id });
    }
    this.clients.clear();
    this.tools.clear();
    this.serverTimeouts.clear();
  }
}
