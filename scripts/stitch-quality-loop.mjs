import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const recurse = path.join(root, "src/domain/recursion");
function dedentTwo(text) {
  return text
    .split("\n")
    .map((line) => (line.startsWith("  ") && line !== "  " ? line.slice(2) : line))
    .join("\n");
}

/** Build exported run / phase / resolver from RecursiveLanguageModel (Phase 40 peel). */
function buildQualityMain(lines) {
  let run_block = dedentTwo(lines.slice(319, 664).join("\n"));
  run_block = run_block.replace(
    "private async runQualityLoop(task:",
    "export async function runQualityLoop(\n  host: QualityLoopHost,\n  task:",
  );
  run_block = run_block.replaceAll(
    "this.execution?.getQualityLoopDecision?.(task.id)",
    "host.getQualityLoopDecision(task.id)",
  );
  run_block = run_block.replaceAll("this.modelCalls", "host.getModelCalls()");
  run_block = run_block.replaceAll("this.maxModelCalls", "host.getMaxModelCalls()");
  run_block = run_block.replaceAll("this.writeLoopMetadata", "host.writeLoopMetadata");
  run_block = run_block.replaceAll(
    "this.markExecutionNodeRunning",
    "host.markExecutionNodeRunning",
  );
  run_block = run_block.replaceAll("this.markExecutionNodeFailed", "host.markExecutionNodeFailed");
  run_block = run_block.replaceAll(
    "this.markExecutionNodeCompleted",
    "host.markExecutionNodeCompleted",
  );
  run_block = run_block.replaceAll("this.emitExecution", "host.emitExecution");
  run_block = run_block.replaceAll(
    "this.summarizeQualityLoopUsage",
    "host.summarizeQualityLoopUsage",
  );
  run_block = run_block.replaceAll("this.throwIfCancelled", "host.throwIfCancelled");
  run_block = run_block.replaceAll(
    'this.metadata.executionStatus = "failed"',
    'host.setMetadataExecutionStatus("failed")',
  );
  run_block = run_block.replaceAll(
    'this.metadata.executionStatus = "cancelled"',
    'host.setMetadataExecutionStatus("cancelled")',
  );
  run_block = run_block.replaceAll(
    'this.metadata.executionStatus = "completed"',
    'host.setMetadataExecutionStatus("completed")',
  );
  run_block = run_block.replaceAll(
    "this.metadata.toolCalls.length",
    "host.getToolCallsUsedCount()",
  );
  run_block = run_block.replace(
    /await this\.completeQualityLoopPhase\(\s*/g,
    "await completeQualityLoopPhase(\n      host,\n      ",
  );
  run_block = run_block.replaceAll(
    "Awaited<ReturnType<typeof this.completeQualityLoopPhase>>",
    "Awaited<ReturnType<typeof completeQualityLoopPhase>>",
  );
  run_block = run_block.replaceAll(
    "subtractUsage(this.metadata.tokenUsage, this.metadata.tokenUsage)",
    "subtractUsage(host.getTokenUsage(), host.getTokenUsage())",
  );
  run_block = run_block.replaceAll(
    "subtractUsage(this.metadata.tokenUsage",
    "subtractUsage(host.getTokenUsage()",
  );
  run_block = run_block.replaceAll("this.execution?.isCancelled()", "host.isExecutionCancelled()");
  run_block = run_block.replaceAll(
    "this.metadata.errors.push(message)",
    "host.pushMetadataError(message)",
  );

  let cq_block = dedentTwo(lines.slice(664, 769).join("\n"));
  cq_block = cq_block.replace(
    "private async completeQualityLoopPhase(",
    "export async function completeQualityLoopPhase(\n  host: QualityLoopHost,\n  ",
  );
  cq_block = cq_block.replaceAll("this.throwIfCancelled(task)", "host.throwIfCancelled(task)");
  cq_block = cq_block.replaceAll(
    "canSpendAnyModelCall(this.modelCalls, this.maxModelCalls)",
    "canSpendAnyModelCall(host.getModelCalls(), host.getMaxModelCalls())",
  );
  cq_block = cq_block.replaceAll(
    "const usageBefore = { ...this.metadata.tokenUsage };",
    "const usageBefore = { ...host.getTokenUsage() };",
  );
  cq_block = cq_block.replaceAll(
    "const modelCallsBefore = this.modelCalls;",
    "const modelCallsBefore = host.getModelCalls();",
  );
  cq_block = cq_block.replace(
    /await this\.resolvePlannedModelAssignment\(\s*\n\s*phase,/,
    "await resolvePlannedModelAssignment(\n    host.model,\n    host.getDepthSelected(),\n    phase,",
  );
  cq_block = cq_block.replaceAll("this.modelCalls += 1;", "host.consumeModelCall();");
  cq_block = cq_block.replaceAll(
    "const callNumber = this.modelCalls;",
    "const callNumber = host.getModelCalls();",
  );
  cq_block = cq_block.replaceAll("this.log(", "host.log(");
  cq_block = cq_block.replaceAll("this.expertTierFor", "host.expertTierFor");
  cq_block = cq_block.replaceAll(
    "await this.model.complete(this.withAgentSystemPrompt(messages)",
    "await host.model.complete(host.withAgentSystemPrompt(messages)",
  );
  cq_block = cq_block.replaceAll(
    "complexityDepth: this.metadata.depth.selected,",
    "complexityDepth: host.getDepthSelected(),",
  );
  cq_block = cq_block.replaceAll("this.updateExecutionNodeModel", "host.updateExecutionNodeModel");
  cq_block = cq_block.replaceAll("this.recordUsage(", "host.recordUsage(");
  cq_block = cq_block.replaceAll(
    "usageDelta: subtractUsage(this.metadata.tokenUsage, usageBefore)",
    "usageDelta: subtractUsage(host.getTokenUsage(), usageBefore)",
  );
  cq_block = cq_block.replaceAll(
    "modelCallsDelta: this.modelCalls - modelCallsBefore",
    "modelCallsDelta: host.getModelCalls() - modelCallsBefore",
  );

  let rp_block = dedentTwo(lines.slice(770, 829).join("\n"));
  rp_block = rp_block.replace(
    "private async resolvePlannedModelAssignment(",
    "export async function resolvePlannedModelAssignment(\n  model: LanguageModelPort,\n  complexityDepth: number,\n  ",
  );
  rp_block = rp_block.replaceAll(
    "const selectableModel = this.model",
    "const selectableModel = model",
  );
  rp_block = rp_block.replaceAll(
    "selectModel?.(purpose, this.metadata.depth.selected)",
    "selectModel?.(purpose, complexityDepth)",
  );

  const banner =
    "// Generated by scripts/stitch-quality-loop.mjs from scripts/phase40-peel-source.ts — do not hand-edit.\n";
  return `${banner}${rp_block}\n\n${cq_block}\n\n${run_block}\n`;
}

const peelSourcePath = path.join(root, "scripts", "phase40-peel-source.ts");
const peelLines = fs.readFileSync(peelSourcePath, "utf8").split("\n");
const fragment =
  fs.readFileSync(path.join(recurse, "quality-loop-helpers.snippet"), "utf8") + "\n";

const header = fs.readFileSync(path.join(recurse, "quality-loop-header.snippet"), "utf8");
const main = buildQualityMain(peelLines);
const outPath = path.join(recurse, "quality-loop.ts");
fs.writeFileSync(outPath, header + fragment + main);
console.log("wrote", outPath);
