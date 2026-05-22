import { createExecutionControl } from "../../application/execution-controller.js";
import { selectAgent } from "../../application/agent-registry.js";
import { runConfiguredAgent } from "../../application/agent-runner.js";
import { runWorkflow } from "../../application/workflow-runner.js";
import type { RecursivePromptResult } from "../../domain/types.js";
import { renderResult } from "../render.js";
import type { RuntimeContext } from "../../application/bootstrap/types.js";

export function setExitCodeIfRunFailed(result: RecursivePromptResult): void {
  if (result.metadata.executionStatus === "failed" || (result.metadata.errors?.length ?? 0) > 0) {
    process.exitCode = 1;
  }
}

async function waitForApproval(): Promise<void> {
  process.stderr.write(
    "Plan generated. Type 'run' and press Enter to execute, or Ctrl+C to cancel.\n",
  );
  const chunks: string[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk.toString());
    const text = chunks.join("").trim().toLowerCase();
    if (text === "run" || text === "yes" || text === "y") {
      return;
    }
    process.stderr.write("Waiting for approval: type 'run' to continue.\n");
    chunks.length = 0;
  }
}

export async function runAskWorkflowOrApprove(ctx: RuntimeContext): Promise<void> {
  const {
    options,
    projectConfig,
    registry,
    runtimeConfig,
    memoryManager,
    createModel,
    logger,
    execution,
    cancellation,
    runState,
    memoryRef,
    loadedConfig,
  } = ctx;

  const runInputBase = {
    prompt: options.prompt,
    config: runtimeConfig,
    projectConfig,
    registry,
    memoryManager,
    createModel,
    logger,
    execution,
    runState,
    memory: memoryRef.current,
  } as const;

  let result = options.workflow
    ? await runWorkflow({
        ...runInputBase,
        workflowId: options.workflow,
        hostId: options.host,
        variant: options.variant,
      })
    : await runConfiguredAgent({
        prompt: runInputBase.prompt,
        config: runInputBase.config,
        projectConfig: runInputBase.projectConfig,
        agent: selectAgent(registry, options.prompt, options.agent),
        agentSource: options.agent ? "override" : "auto",
        memoryManager: runInputBase.memoryManager,
        hostId: options.host,
        createModel: runInputBase.createModel,
        logger: runInputBase.logger,
        execution,
        runState,
        memory: memoryRef.current,
      });

  if (options.requireApproval && !options.planOnly) {
    if (!options.approve) {
      await waitForApproval();
    }
    const executeControl = createExecutionControl({
      planOnly: false,
      cancellation,
      onEvent: execution.onEvent,
    });
    result = options.workflow
      ? await runWorkflow({
          ...runInputBase,
          workflowId: options.workflow,
          hostId: options.host,
          variant: options.variant,
          execution: executeControl,
          runState,
          memory: memoryRef.current,
        })
      : await runConfiguredAgent({
          prompt: runInputBase.prompt,
          config: runInputBase.config,
          projectConfig: runInputBase.projectConfig,
          agent: selectAgent(registry, options.prompt, options.agent),
          agentSource: options.agent ? "override" : "auto",
          memoryManager: runInputBase.memoryManager,
          hostId: options.host,
          createModel: runInputBase.createModel,
          logger: runInputBase.logger,
          execution: executeControl,
          runState,
          memory: memoryRef.current,
        });
  }

  if (loadedConfig.path) {
    result.metadata.configPath = loadedConfig.path;
  }

  console.log(
    renderResult(result, {
      compact: options.compact,
      json: options.json,
      includeTrace: options.trace,
      model: projectConfig.models.default,
    }),
  );
  setExitCodeIfRunFailed(result);
}
