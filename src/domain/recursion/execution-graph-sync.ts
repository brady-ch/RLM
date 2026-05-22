import type { RecursiveModelConfig, RecursivePromptMetadata } from "../types.js";
import { estimateModelCalls, estimateToolRounds, remainingModelCalls } from "./budget-guard.js";

/** Node type from the live execution graph snapshot. */
export type LiveExecutionNode = NonNullable<
  RecursivePromptMetadata["executionGraph"]
>["nodes"][number];

/** Edge type from the live execution graph snapshot. */
export type LiveExecutionEdge = NonNullable<
  RecursivePromptMetadata["executionGraph"]
>["edges"][number];

/** Build `executionGraph` + live `budget` fields from orchestrator maps/counters. */
export function buildLiveExecutionMetadata(input: {
  executionNodes: Map<string, LiveExecutionNode>;
  executionEdges: LiveExecutionEdge[];
  modelCalls: number;
  maxModelCalls: number;
  toolCallsLength: number;
  toolRoundLimit: number;
  config?: RecursiveModelConfig | undefined;
}): Pick<RecursivePromptMetadata, "executionGraph" | "budget"> {
  const config = input.config;
  return {
    executionGraph: {
      nodes: [...input.executionNodes.values()],
      edges: [...input.executionEdges],
    },
    budget: {
      estimatedModelCalls: estimateModelCalls(config, input.modelCalls),
      estimatedToolRounds: estimateToolRounds(input.toolRoundLimit, config),
      modelCallsUsed: input.modelCalls,
      modelCallsRemaining: remainingModelCalls(input.modelCalls, input.maxModelCalls),
      toolCallsUsed: input.toolCallsLength,
    },
  };
}
