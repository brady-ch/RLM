import type { RecursiveModelConfig } from "../types.js";

export function remainingModelCalls(modelCalls: number, maxModelCalls: number): number {
  return maxModelCalls - modelCalls;
}

export function canSpendAnyModelCall(modelCalls: number, maxModelCalls: number): boolean {
  return modelCalls < maxModelCalls;
}

export function maxToolRoundsFromLimit(toolRoundLimit: number): number {
  return Math.max(0, toolRoundLimit);
}

export function hasCallReservedForDirectAnswer(
  modelCalls: number,
  configMaxModelCalls: number,
): boolean {
  return modelCalls < configMaxModelCalls - 1;
}

export function estimateModelCalls(
  config: RecursiveModelConfig | undefined,
  modelCallsUsed: number,
): number {
  if (!config) {
    return Math.max(modelCallsUsed, 1);
  }

  const depth = config.maxDepth ?? config.maxDynamicDepth;
  const branchFactor = Math.max(1, config.maxBranches);
  const maxNodes =
    depth <= 0 ? 1 : Math.floor((Math.pow(branchFactor, depth + 1) - 1) / (branchFactor - 1 || 1));
  return Math.min(config.maxModelCalls, 1 + maxNodes * 4);
}

export function estimateToolRounds(
  toolRoundLimit: number,
  config?: RecursiveModelConfig | undefined,
): number {
  const maxToolRounds = config?.maxToolRounds ?? toolRoundLimit;
  return Math.max(0, maxToolRounds);
}
