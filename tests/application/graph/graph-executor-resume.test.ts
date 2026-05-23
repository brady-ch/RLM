import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { FileRunStateStore } from "../../../src/adapters/index.js";
import { createAgentRegistry } from "../../../src/application/agent-registry.js";
import { createInteractiveExecutionSession } from "../../../src/application/execution-controller.js";
import { executeGraph } from "../../../src/application/graph-executor.js";
import { MemoryManager } from "../../../src/application/memory-manager.js";
import {
  loadProjectConfig,
  resolveRuntimeConfig,
} from "../../../src/application/project-config.js";
import { RunStatePersistence } from "../../../src/domain/run-state-persistence.js";
import type { ExecutionGraphNode, RuntimeRunState } from "../../../src/domain/types.js";
import type {
  LanguageModelCompleteOptions,
  LanguageModelMessage,
  LanguageModelPort,
  LanguageModelResponse,
} from "../../../src/ports/language-model-port.js";

class CountingModel implements LanguageModelPort {
  completeCount = 0;

  async complete(
    _messages: LanguageModelMessage[],
    _options: LanguageModelCompleteOptions = {},
  ): Promise<LanguageModelResponse> {
    this.completeCount += 1;
    return { content: "done", toolCalls: [], model: "counting-model" };
  }
}

function makeNode(
  partial: Partial<ExecutionGraphNode> & Pick<ExecutionGraphNode, "id">,
): ExecutionGraphNode {
  return {
    kind: "task",
    label: partial.label ?? partial.id,
    depth: partial.depth ?? 0,
    status: partial.status ?? "ready",
    ...partial,
  };
}

async function seedPartialRunState(runState: RuntimeRunState): Promise<RunStatePersistence> {
  const persistence = new RunStatePersistence(runState, () => {});
  await persistence.initialize("root task", "default");
  await persistence.persistNodeStatus("root", "completed");
  await persistence.persistResumeCursor({
    activeNodeId: "child",
    completedNodeIds: ["root"],
    variant: "playbook",
  });
  return persistence;
}

test("loadResumeState returns completed ids and active node from seeded snapshot", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rlm-graph-resume-load-"));
  try {
    const runId = "run-resume-load";
    const runState: RuntimeRunState = {
      runId,
      store: new FileRunStateStore({ baseDir: dir, now: () => "2026-05-22T00:00:00.000Z" }),
      actor: "graph-executor",
      capabilityToken: `cap-${runId}`,
    };
    const persistence = await seedPartialRunState(runState);

    const loaded = await persistence.loadResumeState();
    assert.ok(loaded);
    assert.deepEqual(loaded.completedNodeIds.sort(), ["root"]);
    assert.equal(loaded.activeNodeId, "child");
    assert.equal(loaded.variant, "playbook");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("executeGraph with resume skips completed root and completes child with one model call", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rlm-graph-resume-exec-"));
  try {
    const runId = "run-resume-test";
    const runState: RuntimeRunState = {
      runId,
      store: new FileRunStateStore({ baseDir: dir, now: () => "2026-05-22T00:00:00.000Z" }),
      actor: "graph-executor",
      capabilityToken: `cap-${runId}`,
    };
    await seedPartialRunState(runState);

    const loaded = await loadProjectConfig("rlm.config.yaml");
    const projectConfig = loaded.config;
    const runtimeConfig = resolveRuntimeConfig(projectConfig);
    const registry = createAgentRegistry({
      defaultTools: [],
      researchTools: [],
      agentConfigs: projectConfig.agents,
    });
    const memoryManager = new MemoryManager({ config: projectConfig.memory });
    const model = new CountingModel();

    const session = createInteractiveExecutionSession({ approvalMode: "initial-plan-recursive" });
    session.control.registerNode?.(
      makeNode({
        id: "root",
        label: "Root",
        prompt: "Root task",
        depth: 0,
        status: "ready",
        expertAgentId: "default",
        expertRuntime: "single-pass",
      }),
    );
    session.control.registerNode?.(
      makeNode({
        id: "child",
        label: "Child",
        prompt: "Child task",
        depth: 0,
        status: "ready",
        expertAgentId: "default",
        expertRuntime: "single-pass",
      }),
    );
    session.beginConfirmedExecution();

    await executeGraph(session, {
      projectConfig,
      runtimeConfig,
      registry,
      agentSource: "auto",
      memoryManager,
      createModel: () => model,
      runState,
      resume: true,
    });

    const nodes = session.snapshot().graph.nodes;
    assert.equal(nodes.find((node) => node.id === "root")?.status, "completed");
    assert.equal(nodes.find((node) => node.id === "child")?.status, "completed");
    assert.equal(model.completeCount, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
