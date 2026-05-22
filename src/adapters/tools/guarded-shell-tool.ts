import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve, relative } from "node:path";
import { z } from "zod";
import type { ToolExecutionResult, ToolPort } from "../../ports/tool-port.js";

const execFileAsync = promisify(execFile);
const DEFAULT_ALLOWED_COMMANDS = new Set(["pwd", "ls", "rg", "sed", "cat"]);
const BLOCKED_TOKENS = new Set(["|", "&&", "||", ";", ">", ">>", "<", "$(", "`"]);

const shellSchema = z.object({
  command: z.string().describe("A read-only shell command to run in the workspace."),
});

export interface GuardedShellToolOptions {
  workspaceRoot: string;
  allowedCommands?: string[];
}

export class GuardedShellTool implements ToolPort {
  readonly name = "shell";
  readonly description =
    "Run an allowlisted, read-only shell command in the workspace. Use for inspecting files and searching text.";
  readonly schema = shellSchema;

  private readonly workspaceRoot: string;
  private readonly allowedCommands: Set<string>;

  constructor(options: GuardedShellToolOptions) {
    this.workspaceRoot = resolve(options.workspaceRoot);
    this.allowedCommands = new Set(options.allowedCommands ?? DEFAULT_ALLOWED_COMMANDS);
  }

  async execute(args: Record<string, unknown>): Promise<ToolExecutionResult> {
    const parsed = shellSchema.safeParse(args);
    if (!parsed.success) {
      return {
        status: "error",
        output: `Invalid shell tool arguments: ${parsed.error.message}`,
      };
    }

    const command = parsed.data.command.trim();
    const validation = this.validateCommand(command);
    if (validation.status === "error") {
      return validation;
    }

    const [executable, ...commandArgs] = parseCommand(command);
    if (!executable) {
      return { status: "error", output: "Empty command." };
    }

    try {
      const result = await execFileAsync(executable, commandArgs, {
        cwd: this.workspaceRoot,
        timeout: 10_000,
        maxBuffer: 1_000_000,
      });
      return {
        status: "success",
        output: formatShellOutput(result.stdout, result.stderr, 0),
      };
    } catch (error: unknown) {
      if (isExecError(error)) {
        return {
          status: "error",
          output: formatShellOutput(
            error.stdout ?? "",
            error.stderr ?? error.message,
            error.code ?? 1,
          ),
        };
      }

      return {
        status: "error",
        output: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private validateCommand(command: string): ToolExecutionResult {
    if (!command) {
      return { status: "error", output: "Empty command." };
    }

    if (containsBlockedShellSyntax(command)) {
      return {
        status: "error",
        output:
          "Shell control operators, redirection, command substitution, and environment assignment are not allowed.",
      };
    }

    const parts = parseCommand(command);
    const executable = parts[0];
    if (!executable || !this.allowedCommands.has(executable)) {
      return {
        status: "error",
        output: `Command is not allowlisted: ${executable ?? "(empty)"}`,
      };
    }

    for (const arg of parts.slice(1)) {
      if (arg.includes("*") || arg.includes("?")) {
        return { status: "error", output: "Glob arguments are not allowed." };
      }

      if (looksLikePath(arg) && !isWorkspacePath(this.workspaceRoot, arg)) {
        return {
          status: "error",
          output: `Path is outside the workspace: ${arg}`,
        };
      }
    }

    return { status: "success", output: "ok" };
  }
}

function parseCommand(command: string): string[] {
  const parts: string[] = [];
  let current = "";
  let quote: '"' | "'" | undefined;

  for (let index = 0; index < command.length; index += 1) {
    const char = command[index];
    if (!char) {
      continue;
    }

    if ((char === '"' || char === "'") && !quote) {
      quote = char;
      continue;
    }

    if (char === quote) {
      quote = undefined;
      continue;
    }

    if (/\s/.test(char) && !quote) {
      if (current) {
        parts.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (current) {
    parts.push(current);
  }

  return parts;
}

function containsBlockedShellSyntax(command: string): boolean {
  if (/^\s*[A-Za-z_][A-Za-z0-9_]*=/.test(command)) {
    return true;
  }

  return [...BLOCKED_TOKENS].some((token) => command.includes(token));
}

function looksLikePath(arg: string): boolean {
  return arg.startsWith("/") || arg.startsWith(".") || arg.includes("/");
}

function isWorkspacePath(workspaceRoot: string, path: string): boolean {
  const resolved = resolve(workspaceRoot, path);
  const relativePath = relative(workspaceRoot, resolved);
  return relativePath === "" || (!relativePath.startsWith("..") && !relativePath.startsWith("/"));
}

function formatShellOutput(stdout: string, stderr: string, exitCode: number): string {
  return [`exitCode: ${exitCode}`, `stdout:\n${stdout.trim()}`, `stderr:\n${stderr.trim()}`].join(
    "\n",
  );
}

function isExecError(
  error: unknown,
): error is Error & { code?: number; stdout?: string; stderr?: string } {
  return error instanceof Error;
}
