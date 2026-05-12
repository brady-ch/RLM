import { access, readFile, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import { basename, join, resolve } from "node:path";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import type { McpServerConfig } from "./project-config.js";
import type { McpSkillRuntime, SkillCandidate } from "./mcp-skill-runtime.js";
import type { ToolExecutionResult, ToolPort } from "../ports/tool-port.js";

export function createSkillTool(runtime: McpSkillRuntime): ToolPort {
  return {
    name: "skill",
    description: "Load an on-disk skill by name from the configured skill search paths.",
    source: "local",
    schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Skill name to load." },
      },
      required: ["name"],
    },
    async execute(args: Record<string, unknown>): Promise<ToolExecutionResult> {
      const name = String(args["name"] ?? "").trim();
      if (!name) {
        return { status: "error", output: "Skill name is required." };
      }
      const candidates = await discoverSkillCandidates(runtime.getSkillSearchPaths());
      const resolved = await runtime.resolveSkill(name, candidates);
      if (!resolved) {
        return { status: "error", output: `Unknown skill: ${name}` };
      }
      const content = await readFile(resolved.candidate.absolutePath, "utf8");
      return {
        status: "success",
        output: content,
      };
    },
  };
}

export async function discoverSkillCandidates(searchPaths: string[]): Promise<SkillCandidate[]> {
  const candidates: SkillCandidate[] = [];
  for (const searchPath of searchPaths) {
    const root = resolve(searchPath);
    if (!(await readable(root))) {
      continue;
    }
    const entries = await readdir(root, { withFileTypes: true });
    for (const entry of entries) {
      const skillPath = entry.isDirectory()
        ? join(root, entry.name, "SKILL.md")
        : entry.isFile() && entry.name.endsWith(".md")
          ? join(root, entry.name)
          : undefined;
      if (!skillPath || !(await readable(skillPath))) {
        continue;
      }
      candidates.push(await toSkillCandidate(skillPath));
    }
  }
  return candidates;
}

export async function createMcpTools(
  servers: McpServerConfig[],
  runtime: McpSkillRuntime,
  onProcess?: (process: ChildProcessWithoutNullStreams) => void,
): Promise<ToolPort[]> {
  const tools: ToolPort[] = [];
  for (const server of servers) {
    const client = new StdioMcpClient(server);
    onProcess?.(client.process);
    try {
      await client.initialize();
      const listed = await client.listTools();
      for (const tool of listed) {
        tools.push({
          name: `${server.id}.${tool.name}`,
          description: tool.description || `MCP tool ${tool.name} from ${server.id}`,
          schema: tool.inputSchema ?? {},
          source: "mcp",
          execute: (args) => client.callTool(tool.name, args),
        });
      }
    } catch (error: unknown) {
      await runtime.markDisconnected(server.id, error instanceof Error ? error.message : String(error), [], 0);
      if (server.required) {
        throw error;
      }
    }
  }
  return tools;
}

async function toSkillCandidate(path: string): Promise<SkillCandidate> {
  const content = await readFile(path, "utf8");
  const frontmatter = content.match(/^---\n([\s\S]*?)\n---/);
  const name = frontmatter?.[1]?.match(/^name:\s*["']?([^"'\n]+)["']?\s*$/m)?.[1]?.trim()
    ?? basename(resolve(path, ".."));
  return {
    name,
    absolutePath: resolve(path),
    valid: Boolean(frontmatter && name),
    reason: frontmatter ? undefined : "missing frontmatter",
  };
}

async function readable(path: string): Promise<boolean> {
  try {
    await access(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

type JsonRpcResponse = {
  id?: number;
  result?: unknown;
  error?: { message?: string };
};

type McpToolDescriptor = {
  name: string;
  description?: string;
  inputSchema?: unknown;
};

class StdioMcpClient {
  readonly process: ChildProcessWithoutNullStreams;
  private nextId = 1;
  private readonly pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
  private buffer = "";

  constructor(private readonly server: McpServerConfig) {
    this.process = spawn(server.command, server.args ?? [], { stdio: "pipe" });
    this.process.stdout.setEncoding("utf8");
    this.process.stdout.on("data", (chunk: string) => this.onData(chunk));
    this.process.once("error", (error) => this.rejectAll(error));
    this.process.once("exit", (code) => {
      this.rejectAll(new Error(`MCP server ${server.id} exited with code ${code ?? "unknown"}`));
    });
  }

  async initialize(): Promise<void> {
    await this.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "rlm", version: "1.0.0" },
    });
    this.notify("notifications/initialized", {});
  }

  async listTools(): Promise<McpToolDescriptor[]> {
    const result = await this.request("tools/list", {});
    if (!result || typeof result !== "object" || !Array.isArray((result as { tools?: unknown }).tools)) {
      return [];
    }
    return (result as { tools: McpToolDescriptor[] }).tools;
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<ToolExecutionResult> {
    try {
      const result = await this.request("tools/call", { name, arguments: args });
      return { status: "success", output: stringifyToolResult(result) };
    } catch (error: unknown) {
      return { status: "error", output: error instanceof Error ? error.message : String(error) };
    }
  }

  private request(method: string, params: Record<string, unknown>): Promise<unknown> {
    const id = this.nextId++;
    const payload = { jsonrpc: "2.0", id, method, params };
    this.writeMessage(payload);
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  private notify(method: string, params: Record<string, unknown>): void {
    this.writeMessage({ jsonrpc: "2.0", method, params });
  }

  private onData(chunk: string): void {
    this.buffer += chunk;
    for (;;) {
      if (this.buffer.startsWith("Content-Length:")) {
        const headerEnd = this.buffer.indexOf("\r\n\r\n");
        if (headerEnd < 0) {
          return;
        }
        const header = this.buffer.slice(0, headerEnd);
        const length = Number.parseInt(header.match(/Content-Length:\s*(\d+)/i)?.[1] ?? "", 10);
        if (!Number.isFinite(length)) {
          this.rejectAll(new Error("Invalid MCP Content-Length header"));
          return;
        }
        const bodyStart = headerEnd + 4;
        const bodyEnd = bodyStart + length;
        if (this.buffer.length < bodyEnd) {
          return;
        }
        const body = this.buffer.slice(bodyStart, bodyEnd);
        this.buffer = this.buffer.slice(bodyEnd);
        this.handleResponse(JSON.parse(body) as JsonRpcResponse);
        continue;
      }

      const newline = this.buffer.indexOf("\n");
      if (newline < 0) {
        return;
      }
      const line = this.buffer.slice(0, newline).trim();
      this.buffer = this.buffer.slice(newline + 1);
      if (!line) {
        continue;
      }
      this.handleResponse(JSON.parse(line) as JsonRpcResponse);
    }
  }

  private handleResponse(response: JsonRpcResponse): void {
    if (response.id === undefined) {
      return;
    }
    const pending = this.pending.get(response.id);
    if (!pending) {
      return;
    }
    this.pending.delete(response.id);
    if (response.error) {
      pending.reject(new Error(response.error.message ?? "MCP request failed"));
    } else {
      pending.resolve(response.result);
    }
  }

  private writeMessage(payload: unknown): void {
    const body = JSON.stringify(payload);
    this.process.stdin.write(`Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`);
  }

  private rejectAll(error: Error): void {
    for (const pending of this.pending.values()) {
      pending.reject(error);
    }
    this.pending.clear();
  }
}

function stringifyToolResult(result: unknown): string {
  if (typeof result === "string") {
    return result;
  }
  if (result && typeof result === "object" && Array.isArray((result as { content?: unknown }).content)) {
    return (result as { content: Array<{ text?: unknown; type?: unknown }> }).content
      .map((item) => typeof item.text === "string" ? item.text : JSON.stringify(item))
      .join("\n");
  }
  return JSON.stringify(result);
}
