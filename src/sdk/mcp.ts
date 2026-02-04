import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import {
  StreamableHTTPClientTransport,
  StreamableHTTPError,
} from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Tool, CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import fs from "fs";
import path from "path";
import os from "os";
import { renderTable } from "./table.js";

interface McpServerConfig {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  name?: string;
}

interface McpConfig {
  mcpServers: Record<string, McpServerConfig>;
}

type TransportKind = "stdio" | "streamable-http" | "sse";

interface ServerStatus {
  id: string;
  status: "✅ Connected" | "❌ Failed" | "⚠️ Skipped";
  tools: number;
  message: string;
  /** Set when connected via URL; indicates whether server supports Streamable HTTP or legacy SSE. */
  transport?: TransportKind;
}

export class McpManager {
  private clients: Map<string, Client> = new Map();
  private tools: Map<string, { server: string; tool: Tool }> = new Map();

  async loadConfig(configPath: string = path.join(os.homedir(), ".cursor", "mcp.json")): Promise<void> {
    if (!fs.existsSync(configPath)) {
      console.warn(`MCP config not found at ${configPath}`);
      return;
    }

    try {
      const content = fs.readFileSync(configPath, "utf-8");
      const config = JSON.parse(content) as McpConfig;
      const results: ServerStatus[] = [];

      for (const [id, serverConfig] of Object.entries(config.mcpServers)) {
        const status = await this.connectToServer(id, serverConfig);
        results.push(status);
      }

      this.printStatusTable(results);

    } catch (error) {
      console.error("Failed to load MCP config:", error);
    }
  }

  private printStatusTable(results: ServerStatus[]): void {
    const headers = ["Server Name", "Status", "Tools", "Transport", "Message"];
    const rows = results.map((r) => [
      r.id,
      r.status,
      r.tools.toString(),
      r.transport ?? "—",
      r.message,
    ]);
    renderTable(headers, rows, { align: ["left", "left", "right", "left", "left"] });
  }

  /**
   * Returns true if the error indicates the server likely does not support Streamable HTTP
   * (e.g. 4xx on POST or GET), so we should try legacy SSE.
   */
  private isStreamableHttpUnsupported(error: unknown): boolean {
    if (error instanceof StreamableHTTPError && error.code !== undefined) {
      const code = error.code;
      return code >= 400 && code < 500;
    }
    return false;
  }

  private async connectToServer(id: string, config: McpServerConfig): Promise<ServerStatus> {
    try {
      if (config.command) {
        return await this.connectWithStdio(id, config);
      }
      if (config.url) {
        return await this.connectWithUrl(id, config.url);
      }
      return { id, status: "⚠️ Skipped", tools: 0, message: "No command/url" };
    } catch (error: unknown) {
      let msg = error instanceof Error ? error.message : "Unknown error";
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        msg = "Command not found";
      } else if (msg.includes("Non-200")) {
        msg = "Auth/Connection Err";
      }
      return { id, status: "❌ Failed", tools: 0, message: msg };
    }
  }

  private async connectWithStdio(id: string, config: McpServerConfig): Promise<ServerStatus> {
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
      { capabilities: {} }
    );
    await client.connect(transport);
    this.clients.set(id, client);
    return this.registerToolsAndReturnStatus(id, client, "stdio");
  }

  /**
   * Connect to an MCP server by URL. Tries Streamable HTTP first (MCP 2025);
   * if the server returns 4xx (e.g. legacy SSE-only), falls back to SSEClientTransport.
   */
  private async connectWithUrl(id: string, urlStr: string): Promise<ServerStatus> {
    const url = new URL(urlStr);

    try {
      const transport = new StreamableHTTPClientTransport(url);
      const client = new Client(
        { name: "yappr-client", version: "1.0.0" },
        { capabilities: {} }
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
        { capabilities: {} }
      );
      await client.connect(transport);
      this.clients.set(id, client);
      return this.registerToolsAndReturnStatus(id, client, "sse");
    }
  }

  private async registerToolsAndReturnStatus(
    id: string,
    client: Client,
    transport: TransportKind
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
      status: "✅ Connected",
      tools: toolCount,
      message: "Ready",
      transport,
    };
  }

  getOllamaTools() {
    return Array.from(this.tools.values()).map(({ tool }) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }));
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
    const entry = this.tools.get(name);
    if (!entry) {
      throw new Error(`Tool ${name} not found`);
    }

    const { server } = entry;
    const client = this.clients.get(server);
    if (!client) {
      throw new Error(`Server ${server} for tool ${name} is not connected`);
    }

    console.log(`Calling MCP tool '${name}' on server '${server}'...`);
    // Note: The SDK returns CallToolResultSchema which is equivalent to CallToolResult
    return await client.callTool({
      name,
      arguments: args,
    }) as CallToolResult;
  }

  async close(): Promise<void> {
    for (const client of this.clients.values()) {
      try {
        await client.close();
      } catch { /* ignore */ }
    }
  }
}