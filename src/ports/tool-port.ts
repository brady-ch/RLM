import type { LanguageModelTool } from "./language-model-port.js";

export interface ToolPort extends LanguageModelTool {
  source?: "local" | "mcp" | "extension";
  execute(args: Record<string, unknown>): Promise<ToolExecutionResult>;
}

export interface ToolExecutionResult {
  status: "success" | "error";
  output: string;
}
