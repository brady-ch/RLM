import { mkdir, writeFile, appendFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { z } from "zod";
import type { ToolExecutionResult, ToolPort } from "../ports/tool-port.js";

const writeFileSchema = z.object({
  path: z.string().describe("Relative file path to write inside the open workspace directory."),
  content: z.string().describe("The complete file content to write, or content to append when mode is append."),
  mode: z.enum(["overwrite", "append"]).optional().describe("Write mode. Defaults to overwrite."),
});

export interface WorkspaceFileWriteToolOptions {
  workspaceRoot: string;
}

export class WorkspaceFileWriteTool implements ToolPort {
  readonly name = "write_file";
  readonly description =
    "Write content to a file inside the open workspace directory. Use relative paths only. Supports overwrite and append.";
  readonly schema = writeFileSchema;

  private readonly workspaceRoot: string;

  constructor(options: WorkspaceFileWriteToolOptions) {
    this.workspaceRoot = resolve(options.workspaceRoot);
  }

  async execute(args: Record<string, unknown>): Promise<ToolExecutionResult> {
    const parsed = writeFileSchema.safeParse(args);
    if (!parsed.success) {
      return {
        status: "error",
        output: `Invalid write_file arguments: ${parsed.error.message}`,
      };
    }

    const target = this.resolveWorkspacePath(parsed.data.path);
    if (!target) {
      return {
        status: "error",
        output: `Path is outside the open workspace directory: ${parsed.data.path}`,
      };
    }

    try {
      await mkdir(dirname(target), { recursive: true });
      if (parsed.data.mode === "append") {
        await appendFile(target, parsed.data.content, "utf8");
      } else {
        await writeFile(target, parsed.data.content, "utf8");
      }

      const relativePath = relative(this.workspaceRoot, target);
      return {
        status: "success",
        output: `${parsed.data.mode ?? "overwrite"} wrote ${Buffer.byteLength(parsed.data.content, "utf8")} bytes to ${relativePath}`,
      };
    } catch (error: unknown) {
      return {
        status: "error",
        output: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private resolveWorkspacePath(path: string): string | undefined {
    if (!path.trim()) {
      return undefined;
    }

    const resolved = resolve(this.workspaceRoot, path);
    const relativePath = relative(this.workspaceRoot, resolved);
    if (relativePath === "" || relativePath.startsWith("..") || relativePath.startsWith("/")) {
      return undefined;
    }

    return resolved;
  }
}
