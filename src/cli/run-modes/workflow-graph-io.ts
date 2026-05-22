import type { FileSessionStore } from "../../adapters/file-session-store.js";
import {
  exportAndSaveGraphWorkflow,
  loadGraphWorkflow,
} from "../../application/graph-workflow-store.js";
import {
  defaultSaveVariant,
  importSidecarToGraph,
} from "../../application/graph-workflow-serializer.js";
import type { GraphWorkflowSaveVariant } from "../../application/graph-workflow-types.js";
import type { CliOptions } from "../args.js";

export function parseWorkflowExportVariant(
  variant: CliOptions["variant"],
): GraphWorkflowSaveVariant | undefined {
  if (!variant) {
    return undefined;
  }
  if (variant === "playbook" || variant === "pipeline") {
    return variant;
  }
  return undefined;
}

export async function handleWorkflowExport(
  options: CliOptions,
  sessionStore: FileSessionStore,
  cwd: string,
): Promise<void> {
  const workflowId = options.workflow?.trim();
  const sessionId = options.exportSession?.trim();
  if (!workflowId) {
    throw new Error("workflow-export requires --workflow <id>.");
  }
  if (!sessionId) {
    throw new Error("workflow-export requires --export-session <id>.");
  }
  const saved = await sessionStore.load(sessionId);
  const sessionGraph = (
    saved.payload.session as { graph?: import("../../domain/types.js").ExecutionGraph }
  ).graph;
  if (!sessionGraph || sessionGraph.nodes.length === 0) {
    throw new Error(`Saved session "${sessionId}" has no graph to export.`);
  }
  const variant = parseWorkflowExportVariant(options.variant) ?? defaultSaveVariant(sessionGraph);
  const result = await exportAndSaveGraphWorkflow({
    workflowId,
    description: options.exportDescription,
    variant,
    graph: sessionGraph,
    projectRoot: cwd,
  });
  console.log(
    JSON.stringify(
      {
        workflowId,
        path: result.path,
        variant,
        nodeCount: sessionGraph.nodes.length,
        updatedAt: result.sidecar.updatedAt,
      },
      null,
      2,
    ),
  );
}

export async function handleWorkflowImport(options: CliOptions, cwd: string): Promise<void> {
  const workflowId = (options.importWorkflow ?? options.workflow)?.trim();
  if (!workflowId) {
    throw new Error("workflow-import requires --workflow <id> or --import-workflow <id>.");
  }
  const sidecar = await loadGraphWorkflow(workflowId, { projectRoot: cwd });
  const variant = options.variant === "pipeline" ? "pipeline" : "playbook";
  const imported = importSidecarToGraph(sidecar, variant);
  console.log(
    JSON.stringify(
      {
        workflowId,
        variant: imported.variant,
        nodeCount: imported.graph.nodes.length,
        expertNodes: imported.graph.nodes
          .filter((node) => node.expertAgentId && node.expertAgentId !== "default")
          .map((node) => ({ id: node.id, expertAgentId: node.expertAgentId })),
      },
      null,
      2,
    ),
  );
}
