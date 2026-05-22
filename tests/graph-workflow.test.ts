import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createAgentRegistry } from "../src/application/agent-registry.js";
import {
  applyPipelineTemplate,
  exportSessionGraphToSidecar,
  importSidecarToGraph,
  parseGraphWorkflowSidecar,
  rootPromptSuitableForPipeline,
} from "../src/application/graph-workflow-serializer.js";
import {
  exportAndSaveGraphWorkflow,
  listGraphWorkflows,
  loadGraphWorkflow,
} from "../src/application/graph-workflow-store.js";
import {
  GraphWorkflowRunError,
  resolveGraphWorkflowVariant,
  validateGraphForRun,
} from "../src/application/graph-workflow-runner.js";
import { loadProjectConfig } from "../src/application/project-config.js";
import type { ExecutionGraph, ExecutionGraphNode } from "../src/domain/types.js";
import { parse as parseYaml } from "yaml";

function makeNode(partial: Partial<ExecutionGraphNode> & Pick<ExecutionGraphNode, "id">): ExecutionGraphNode {
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

function sampleGraph(): ExecutionGraph {
  return {
    nodes: [
      makeNode({ id: "root-composer", label: "Root", prompt: "Build auth middleware", depth: 0 }),
      makeNode({
        id: "child-1",
        parentId: "root-composer",
        label: "Child",
        prompt: "Implement JWT validation",
        depth: 1,
        expertAgentId: "coding",
        expertAssignmentMode: "planner",
        expertToolAllowlist: ["shell", "write_file"],
        expertPurposeTiers: { answer: "small" },
      }),
    ],
    edges: [{ from: "root-composer", to: "child-1" }],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

test("export and import round-trip preserves expert fields", () => {
  const graph = sampleGraph();
  const sidecar = exportSessionGraphToSidecar({
    workflowId: "feature-delivery",
    variant: "both",
    graph,
  });

  assert.ok(sidecar.variants.playbook?.graph);
  assert.ok(sidecar.variants.pipeline?.graph);

  const child = sidecar.variants.playbook!.graph.nodes.find((node) => node.id === "child-1");
  assert.equal(child?.expertAgentId, "coding");
  assert.deepEqual(child?.expertToolAllowlist, ["shell", "write_file"]);
  assert.equal(child?.expertPurposeTiers?.answer, "small");

  const imported = importSidecarToGraph(sidecar, "playbook");
  assert.equal(imported.graph.nodes.length, 2);
  assert.equal(imported.graph.nodes[1]?.expertAgentId, "coding");
});

test("pipeline variant stores {{input}} at root", () => {
  const sidecar = exportSessionGraphToSidecar({
    workflowId: "pipeline-flow",
    variant: "pipeline",
    graph: sampleGraph(),
  });

  const root = sidecar.variants.pipeline?.graph.nodes.find((node) => node.id === "root-composer");
  assert.equal(root?.prompt, "{{input}}");
  assert.equal(sidecar.variants.playbook, undefined);
});

test("applyPipelineTemplate replaces root {{input}} only", () => {
  const sidecar = exportSessionGraphToSidecar({
    workflowId: "pipeline-flow",
    variant: "pipeline",
    graph: sampleGraph(),
  });
  const imported = importSidecarToGraph(sidecar, "pipeline");
  const applied = applyPipelineTemplate(imported.graph, { input: "Add rate limiting" });

  const root = applied.nodes.find((node) => node.id === "root-composer");
  const child = applied.nodes.find((node) => node.id === "child-1");
  assert.equal(root?.prompt, "Add rate limiting");
  assert.equal(child?.prompt, "Implement JWT validation");
});

test("resolveGraphWorkflowVariant prefers explicit override and smart defaults", () => {
  assert.equal(resolveGraphWorkflowVariant({ prompt: "", explicitVariant: "pipeline" }), "pipeline");
  assert.equal(resolveGraphWorkflowVariant({ prompt: "new task" }), "pipeline");
  assert.equal(resolveGraphWorkflowVariant({ prompt: "", defaultVariant: "playbook" }), "playbook");
  assert.equal(resolveGraphWorkflowVariant({ prompt: "" }), "playbook");
});

test("validateGraphForRun fails for missing agent and missing template", async () => {
  const loaded = await loadProjectConfig("rlm.config.yaml");
  const registry = createAgentRegistry({
    defaultTools: [],
    researchTools: [],
    agentConfigs: loaded.config.agents,
  });

  const badAgentGraph: ExecutionGraph = {
    nodes: [makeNode({ id: "root", prompt: "task", expertAgentId: "missing-agent" })],
    edges: [],
  };

  assert.throws(
    () => validateGraphForRun(badAgentGraph, loaded.config, registry, "playbook"),
    (error: unknown) => error instanceof GraphWorkflowRunError && error.code === "missing_agent",
  );

  const pipelineGraph: ExecutionGraph = {
    nodes: [makeNode({ id: "root", prompt: "literal only" })],
    edges: [],
  };

  assert.throws(
    () => validateGraphForRun(pipelineGraph, loaded.config, registry, "pipeline"),
    (error: unknown) => error instanceof GraphWorkflowRunError && error.code === "missing_template",
  );
});

test("store saves and lists sidecar files", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "rlm-graph-workflow-"));
  try {
    const saved = await exportAndSaveGraphWorkflow({
      workflowId: "demo-flow",
      variant: "both",
      graph: sampleGraph(),
      projectRoot,
    });
    assert.match(saved.path, /demo-flow\.yaml$/);

    const listed = await listGraphWorkflows(projectRoot);
    assert.equal(listed.length, 1);
    assert.equal(listed[0]?.id, "demo-flow");
    assert.deepEqual(listed[0]?.variants.sort(), ["pipeline", "playbook"]);

    const loaded = await loadGraphWorkflow("demo-flow", { projectRoot });
    assert.equal(loaded.graphId, "demo-flow");
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("parseGraphWorkflowSidecar rejects invalid documents", () => {
  assert.throws(
    () => parseGraphWorkflowSidecar({ kind: "agent-list" }),
    /kind must be "graph"/,
  );
});

test("rootPromptSuitableForPipeline detects substitutable roots", () => {
  assert.equal(rootPromptSuitableForPipeline(sampleGraph()), true);
  assert.equal(
    rootPromptSuitableForPipeline({
      nodes: [makeNode({ id: "root-composer", prompt: "{{input}}" })],
      edges: [],
    }),
    false,
  );
});

test("yaml round-trip through disk preserves schema", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "rlm-graph-workflow-"));
  try {
    const sidecar = exportSessionGraphToSidecar({
      workflowId: "yaml-roundtrip",
      variant: "both",
      graph: sampleGraph(),
    });
    const path = join(projectRoot, ".rlm", "workflows", "yaml-roundtrip.yaml");
    await mkdir(join(projectRoot, ".rlm", "workflows"), { recursive: true });
    await writeFile(path, JSON.stringify(sidecar));
    const raw = parseYaml(await readFile(path, "utf8"));
    const parsed = parseGraphWorkflowSidecar(raw);
    assert.equal(parsed.graphId, "yaml-roundtrip");
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});
