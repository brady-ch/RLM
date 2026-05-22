import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { FileMemoryStore, FileSessionStore, FileVectorIndex } from "../src/adapters/index.js";
import { createInteractiveExecutionSession } from "../src/application/execution-controller.js";
import {
  exportAndSaveGraphWorkflow,
  resolveDiskGraphWorkflowConfig,
} from "../src/application/graph-workflow-store.js";
import {
  exportSessionGraphToSidecar,
  importSidecarToGraph,
} from "../src/application/graph-workflow-serializer.js";
import { loadProjectConfig } from "../src/application/project-config.js";
import { runWorkflow } from "../src/application/workflow-runner.js";
import {
  buildSavedSessionPayload,
  restoreGraphWorkflowMetadata,
  restoreSessionMemory,
} from "../src/application/session-memory-bridge.js";
import { MemoryManager } from "../src/application/memory-manager.js";
import { createAgentRegistry } from "../src/application/agent-registry.js";
import type { ExecutionGraphNode } from "../src/domain/types.js";
import type { LanguageModelPort } from "../src/ports/language-model-port.js";

const genericPlanChildren = [
  { label: "Step one", prompt: "Do step one", type: "AI", complexity: "medium" },
  { label: "Step two", prompt: "Do step two", type: "Code", complexity: "low" },
];

function createMockPlanModel(): LanguageModelPort {
  return {
    async complete() {
      return {
        content: JSON.stringify({ children: genericPlanChildren }),
        toolCalls: [],
        model: "mock-planner",
      };
    },
  };
}

function makeNode(
  partial: Partial<ExecutionGraphNode> & Pick<ExecutionGraphNode, "id">,
): ExecutionGraphNode {
  return {
    kind: "task",
    label: partial.label ?? partial.id,
    depth: partial.depth ?? 0,
    status: partial.status ?? "ready",
    expertAgentId: partial.expertAgentId ?? "default",
    expertRuntime: partial.expertRuntime ?? "single-pass",
    ...partial,
  };
}

test("plan-node replan protection exposes UI-aligned MutationError vocabulary", async () => {
  const session = createInteractiveExecutionSession({
    seedRootPrompt: "Plan this workflow",
    planModel: createMockPlanModel(),
  });
  const firstPlan = await session.planNode("root-composer");
  const childId = firstPlan.plannedNodeIds[0]!;
  session.setNodeExpertOverride(childId, {
    agentId: "research",
    runtime: "single-pass",
    toolAllowlist: ["web_search"],
    purposeTiers: { answer: "small" },
  });

  await assert.rejects(
    () => session.planNode("root-composer"),
    (error: unknown) => {
      const mutation = session.toMutationError(error);
      assert.equal(mutation?.code, "replan_requires_choice");
      assert.match(mutation?.message ?? "", /Replace subtree, Merge, or Cancel/i);
      assert.equal(mutation?.suggestedFix, "Choose replace, merge, or cancel before replanning.");
      return true;
    },
  );
});

test("workflow export round-trip resolves from disk without config registration", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "rlm-v15-export-"));
  try {
    const graph = {
      nodes: [
        makeNode({ id: "root-composer", label: "Root", prompt: "Ship feature", depth: 0 }),
        makeNode({
          id: "child-1",
          parentId: "root-composer",
          label: "Implement",
          prompt: "Write code",
          depth: 1,
          expertAgentId: "coding",
        }),
      ],
      edges: [{ from: "root-composer", to: "child-1" }],
    };

    await exportAndSaveGraphWorkflow({
      workflowId: "disk-only-flow",
      variant: "playbook",
      graph,
      projectRoot,
    });

    const resolved = await resolveDiskGraphWorkflowConfig("disk-only-flow", projectRoot);
    assert.deepEqual(resolved, { kind: "graph" });

    const loaded = await loadProjectConfig("rlm.config.yaml");
    const projectConfig = {
      ...loaded.config,
      workflows: {},
    };
    const registry = createAgentRegistry({
      defaultTools: [],
      researchTools: [],
      agentConfigs: projectConfig.agents,
    });
    const memoryManager = new MemoryManager({ config: projectConfig.memory });

    await assert.rejects(
      () =>
        runWorkflow({
          workflowId: "missing-flow",
          prompt: "",
          config: projectConfig.runtime,
          projectConfig,
          registry,
          memoryManager,
          createModel: () => createMockPlanModel(),
        }),
      /Unknown workflow "missing-flow"/,
    );

    const sidecar = exportSessionGraphToSidecar({
      workflowId: "disk-only-flow",
      variant: "playbook",
      graph,
    });
    const imported = importSidecarToGraph(sidecar, "playbook");
    assert.equal(imported.graph.nodes[1]?.expertAgentId, "coding");
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("session save and restore preserves expert fields and graph workflow metadata", async () => {
  const dir = await mkdtemp(join(tmpdir(), "rlm-v15-session-"));
  try {
    const memoryStore = new FileMemoryStore({
      baseDir: join(dir, "memory"),
      now: () => "2026-05-22T00:00:00.000Z",
    });
    const vectorIndex = new FileVectorIndex({ path: join(dir, "vector-index.json") });
    const sessionStore = new FileSessionStore({
      baseDir: join(dir, "sessions"),
      now: () => "2026-05-22T00:00:00.000Z",
    });
    const session = createInteractiveExecutionSession({
      seedRootPrompt: "Expert binding session",
      planModel: createMockPlanModel(),
    });
    await session.planNode("root-composer");
    const childId = session
      .snapshot()
      .graph.nodes.find((node) => node.parentId === "root-composer")?.id;
    assert.ok(childId);
    session.setNodeExpertOverride(childId, {
      agentId: "coding",
      runtime: "rlm",
      toolAllowlist: ["shell"],
      purposeTiers: { answer: "medium" },
    });
    session.patchGraphWorkflowMetadata({
      linkedWorkflowId: "feature-delivery",
      lastVariant: "both",
      exportedAt: "2026-05-22T00:00:00.000Z",
    });

    const runId = "run-v15-metadata";
    const payload = await buildSavedSessionPayload({
      snapshot: session.snapshot(),
      runId,
      memoryStore,
      vectorIndex,
      graphWorkflowMetadata: session.getGraphWorkflowMetadata(),
    });
    const saved = await sessionStore.save({ id: "v15-session", payload });
    assert.equal(saved.status, "complete");

    const restoredSession = createInteractiveExecutionSession({ planModel: createMockPlanModel() });
    const loaded = await sessionStore.load("v15-session");
    restoredSession.restoreSnapshot(
      loaded.payload.session as ReturnType<typeof restoredSession.snapshot>,
    );
    const metadataRestore = restoreGraphWorkflowMetadata(loaded.payload);
    restoredSession.setGraphWorkflowMetadata(metadataRestore.metadata);

    const child = restoredSession.snapshot().graph.nodes.find((node) => node.id === childId);
    assert.equal(child?.expertAgentId, "coding");
    assert.equal(child?.expertRuntime, "rlm");
    assert.deepEqual(child?.expertToolAllowlist, ["shell"]);
    assert.equal(child?.expertPurposeTiers?.answer, "medium");

    const metadata = restoredSession.getGraphWorkflowMetadata();
    assert.equal(metadata.linkedWorkflowId, "feature-delivery");
    assert.equal(metadata.lastVariant, "both");
    assert.equal(metadata.exportedAt, "2026-05-22T00:00:00.000Z");

    const legacyPayload = {
      ...loaded.payload,
      graphWorkflowMetadata: undefined,
    };
    const legacyRestore = restoreGraphWorkflowMetadata(legacyPayload);
    assert.equal(legacyRestore.degraded, true);
    assert.match(legacyRestore.note ?? "", /v1\.5 graph workflow metadata/i);

    await restoreSessionMemory({ payload: loaded.payload, memoryStore, vectorIndex });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
