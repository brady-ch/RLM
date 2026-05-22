import fs from "node:fs";

const path = new URL("../src/domain/recursive-language-model.ts", import.meta.url);
let s = fs.readFileSync(path, "utf8");

const needle = 'import { RunStatePersistence } from "./run-state-persistence.js";\n\n';
if (!s.includes(needle)) {
  throw new Error("RunStatePersistence needle missing.");
}
const IMPORT_BLOCK = `import { RunStatePersistence } from "./run-state-persistence.js";
import {
  clamp,
  fallbackFromMessages,
  isCodeTask,
  limitPrompt,
  parseClarificationRequest,
  parseFirstInteger,
  preview,
  toModelPurpose,
} from "./recursion/prompt-utilities.js";
import {
  canSpendAnyModelCall,
  estimateModelCalls,
  estimateToolRounds,
  hasCallReservedForDirectAnswer,
  maxToolRoundsFromLimit,
  remainingModelCalls,
} from "./recursion/budget-guard.js";
import { buildLiveExecutionMetadata } from "./recursion/execution-graph-sync.js";

`;
s = s.replace(needle, IMPORT_BLOCK);

const oldGraph = `  private updateExecutionGraph(): void {
    this.metadata.executionGraph = {
      nodes: [...this.executionNodes.values()],
      edges: [...this.executionEdges],
    };
    this.metadata.budget = {
      estimatedModelCalls: this.estimateModelCalls(undefined),
      estimatedToolRounds: this.estimateToolRounds(undefined),
      modelCallsUsed: this.modelCalls,
      modelCallsRemaining: this.remainingModelCalls(),
      toolCallsUsed: this.metadata.toolCalls.length,
    };
  }
`;
const newGraph = `  private updateExecutionGraph(): void {
    const live = buildLiveExecutionMetadata({
      executionNodes: this.executionNodes,
      executionEdges: this.executionEdges,
      modelCalls: this.modelCalls,
      maxModelCalls: this.maxModelCalls,
      toolCallsLength: this.metadata.toolCalls.length,
      toolRoundLimit: this.toolRoundLimit,
      config: undefined,
    });
    this.metadata.executionGraph = live.executionGraph;
    this.metadata.budget = live.budget;
  }
`;
if (!s.includes(oldGraph)) throw new Error("graph anchor missing");
s = s.replace(oldGraph, newGraph);

for (const [a, b] of [
  ["this.limitPrompt(", "limitPrompt("],
  ["this.remainingModelCalls()", "remainingModelCalls(this.modelCalls, this.maxModelCalls)"],
  ["this.canSpendAnyModelCall()", "canSpendAnyModelCall(this.modelCalls, this.maxModelCalls)"],
  ["this.maxToolRounds()", "maxToolRoundsFromLimit(this.toolRoundLimit)"],
  [
    "this.hasCallReservedForDirectAnswer(config)",
    "hasCallReservedForDirectAnswer(this.modelCalls, config.maxModelCalls)",
  ],
  ["this.estimateModelCalls(config)", "estimateModelCalls(config, this.modelCalls)"],
  ["this.estimateModelCalls(undefined)", "estimateModelCalls(undefined, this.modelCalls)"],
  ["this.estimateToolRounds(config)", "estimateToolRounds(this.toolRoundLimit, config)"],
  ["this.estimateToolRounds(undefined)", "estimateToolRounds(this.toolRoundLimit, undefined)"],
]) {
  s = s.split(a).join(b);
}

for (const block of [
  `

  private hasCallReservedForDirectAnswer(config: RecursiveModelConfig): boolean {
    return this.modelCalls < config.maxModelCalls - 1;
  }

  private canSpendAnyModelCall(): boolean {
    return this.modelCalls < this.maxModelCalls;
  }

  private remainingModelCalls(): number {
    return this.maxModelCalls - this.modelCalls;
  }

  private maxToolRounds(): number {
    return Math.max(0, this.toolRoundLimit);
  }

`,
  `

  private estimateModelCalls(config: RecursiveModelConfig | undefined): number {
    if (!config) {
      return Math.max(this.modelCalls, 1);
    }

    const depth = config.maxDepth ?? config.maxDynamicDepth;
    const branchFactor = Math.max(1, config.maxBranches);
    const maxNodes =
      depth <= 0
        ? 1
        : Math.floor((Math.pow(branchFactor, depth + 1) - 1) / (branchFactor - 1 || 1));
    return Math.min(config.maxModelCalls, 1 + maxNodes * 4);
  }

  private estimateToolRounds(config: RecursiveModelConfig | undefined): number {
    const maxToolRounds = config?.maxToolRounds ?? this.toolRoundLimit;
    return Math.max(0, maxToolRounds);
  }

  private limitPrompt(prompt: string, config: RecursiveModelConfig): string {
    if (prompt.length <= config.maxPromptCharacters) {
      return prompt;
    }

    return prompt.slice(0, config.maxPromptCharacters).trimEnd();
  }

`,
]) {
  s = s.replace(block, "\n");
}

while (true) {
  const pattern = "\nfunction preview(value: string, maxLength = 180): string {";
  const from = s.indexOf(pattern);
  if (from < 0) break;
  const toPurpose = s.indexOf("function toModelPurpose(", from);
  if (toPurpose < 0) throw new Error("toModelPurpose duplicate block missing");
  const ret = s.indexOf("return undefined;", toPurpose);
  const close = s.indexOf("}", ret);
  s = s.slice(0, from) + "\n" + s.slice(close + 2);
}

fs.writeFileSync(path, s);
console.log("patched recursive-language-model.ts (core modules only)");
