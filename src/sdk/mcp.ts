import fs from "fs";
import os from "os";
import path from "path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import {
  StreamableHTTPClientTransport,
  StreamableHTTPError,
} from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";
import { toolDefinition, type ServerTool } from "@tanstack/ai";
import { errAsync, okAsync, ResultAsync } from "neverthrow";
import type { Tool as OllamaTool } from "ollama";

import { toError } from "~/lib/result.js";

import type {
  McpConfig,
  McpServerConfig,
  ServerStatus,
  TransportKind,
} from "./types.js";

export class McpManager {
  private clients: Map<string, Client> = new Map();
  private tools: Map<string, { server: string; tool: Tool }> = new Map();

  loadConfigAndGetStatuses(
    configPath: string = path.join(os.homedir(), ".cursor", "mcp.json"),
  ): ResultAsync<ServerStatus[], Error> {
    if (!fs.existsSync(configPath)) return okAsync([]);

    return ResultAsync.fromPromise(
      (async (): Promise<ServerStatus[]> => {
        const content = fs.readFileSync(configPath, "utf-8");
        const config = JSON.parse(content) as McpConfig;
        const results: ServerStatus[] = [];
        for (const [id, serverConfig] of Object.entries(config.mcpServers)) {
          const status = await this.connectToServer(id, serverConfig);
          results.push(status);
        }
        return results;
      })(),
      toError,
    );
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
    try {
      if (config.command) {
        return await this.connectWithStdio(id, config);
      }
      if (config.url) {
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
    const result = await client.listTools();
    const toolCount = result.tools?.length ?? 0;
    if (result.tools) {
      for (const tool of result.tools) {
        this.tools.set(tool.name, { server: id, tool });
      }
    }
    return {
      id,
      status: "[OK] Connected",
      tools: toolCount,
      message: "Ready",
      transport,
    };
  }

  getOllamaTools(): OllamaTool[] {
    return Array.from(this.tools.values()).map(({ tool }) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }));
  }

  getTanStackTools(): ServerTool<unknown, unknown>[] {
    return Array.from(this.tools.values()).map(({ tool }) => {
      const def = toolDefinition({
        name: tool.name,
        description: tool.description || "",
        inputSchema: tool.inputSchema,
      });

      return def.server(async (args: unknown) => {
        const result = await this.callTool(
          tool.name,
          args as Record<string, unknown>,
        );
        if (result.isErr()) {
          throw result.error;
        }
        return result.value.content;
      });
    });
  }

  callTool(
    name: string,
    args: Record<string, unknown>,
  ): ResultAsync<CallToolResult, Error> {
    const entry = this.tools.get(name);
    if (!entry) {
      return errAsync(new Error(`Tool ${name} not found`));
    }

    const { server } = entry;
    const client = this.clients.get(server);
    if (!client) {
      return errAsync(
        new Error(`Server ${server} for tool ${name} is not connected`),
      );
    }

    console.log(`Calling MCP tool '${name}' on server '${server}'...`);
    return ResultAsync.fromPromise(
      client.callTool({ name, arguments: args }) as Promise<CallToolResult>,
      toError,
    );
  }

  async close(): Promise<void> {
    for (const client of this.clients.values()) {
      try {
        await client.close();
      } catch {
        /* ignore */
      }
    }
  }
}
