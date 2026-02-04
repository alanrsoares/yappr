import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import type { Tool, CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import fs from "fs";
import path from "path";
import os from "os";

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

interface ServerStatus {
  id: string;
  status: "✅ Connected" | "❌ Failed" | "⚠️ Skipped";
  tools: number;
  message: string;
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
    console.log("\n┌──────────────────────────────┬──────────────┬───────┬────────────────────────────────┐");
    console.log("│ Server Name                  │ Status       │ Tools │ Message                        │");
    console.log("├──────────────────────────────┼──────────────┼───────┼────────────────────────────────┤");

    for (const res of results) {
      const name = res.id.padEnd(28).slice(0, 28);
      const status = res.status.padEnd(12).slice(0, 12);
      const tools = res.tools.toString().padStart(5);
      const msg = res.message.padEnd(30).slice(0, 30);
      console.log(`│ ${name} │ ${status} │ ${tools} │ ${msg} │`);
    }
    console.log("└──────────────────────────────┴──────────────┴───────┴────────────────────────────────┘\n");
  }

  private async connectToServer(id: string, config: McpServerConfig): Promise<ServerStatus> {
    try {
      let transport;

      if (config.command) {
        // Filter out undefined env values to satisfy Record<string, string>
        const env: Record<string, string> = {};
        const combinedEnv = { ...process.env, ...config.env };
        for (const [key, value] of Object.entries(combinedEnv)) {
            if (value !== undefined) {
                env[key] = value;
            }
        }

        transport = new StdioClientTransport({
          command: config.command,
          args: config.args || [],
          env,
          stderr: 'ignore'
        });
      } else if (config.url) {
        transport = new SSEClientTransport(new URL(config.url), {
          eventSourceInit: {}
        });
      } else {
        return { id, status: "⚠️ Skipped", tools: 0, message: "No command/url" };
      }

      const client = new Client(
        { name: "yappr-client", version: "1.0.0" },
        { 
          capabilities: {} // Basic capabilities
        }
      );

      await client.connect(transport);
      this.clients.set(id, client);

      const result = await client.listTools();
      const toolCount = result.tools ? result.tools.length : 0;

      if (result.tools) {
        for (const tool of result.tools) {
          this.tools.set(tool.name, { server: id, tool });
        }
      }
      return { id, status: "✅ Connected", tools: toolCount, message: "Ready" };

    } catch (error: any) {
      let msg = error.message || "Unknown error";
      if (error.code === 'ENOENT') {
        msg = "Command not found";
      } else if (msg.includes("Non-200")) {
        msg = "Auth/Connection Err";
      }
      return { id, status: "❌ Failed", tools: 0, message: msg };
    }
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