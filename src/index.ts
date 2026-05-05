#!/usr/bin/env node
import { OllamaLanguageModelAdapter } from "./adapters/ollama-language-model.js";
import { GuardedShellTool } from "./adapters/guarded-shell-tool.js";
import { InMemoryTrace } from "./adapters/in-memory-trace.js";
import { WorkspaceFileWriteTool } from "./adapters/workspace-file-write-tool.js";
import { runRecursivePrompt } from "./application/run-recursive-prompt.js";
import { helpText, parseArgs } from "./cli/args.js";
import { renderResult } from "./cli/render.js";

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (options.command === "help") {
    console.log(helpText());
    return;
  }

  const modelOptions: ConstructorParameters<typeof OllamaLanguageModelAdapter>[0] = {
    model: options.model,
  };
  if (options.baseUrl) {
    modelOptions.baseUrl = options.baseUrl;
  }

  const model = new OllamaLanguageModelAdapter(modelOptions);
  const trace = new InMemoryTrace();
  const tools = [
    new GuardedShellTool({
      workspaceRoot: process.cwd(),
    }),
    new WorkspaceFileWriteTool({
      workspaceRoot: process.cwd(),
    }),
  ];
  const result = await runRecursivePrompt({
    prompt: options.prompt,
    config: options.config,
    model,
    trace,
    tools,
  });

  console.log(
    renderResult(result, {
      compact: options.compact,
      json: options.json,
      includeTrace: options.trace,
      model: options.model,
    }),
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  if (process.argv.includes("--json")) {
    console.error(JSON.stringify({ error: message }));
  } else {
    console.error(`RLM failed: ${message}`);
  }
  process.exitCode = 1;
});
