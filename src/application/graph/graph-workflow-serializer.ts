import type { ExecutionGraph, ExecutionGraphNode, ExecutionStatus } from "../../domain/types.js";
import {
  GRAPH_WORKFLOW_SCHEMA_VERSION,
  type GraphWorkflowExportInput,
  type GraphWorkflowImportResult,
  type GraphWorkflowSaveVariant,
  type GraphWorkflowSidecar,
  type GraphWorkflowVariant,
  type SerializedGraphWorkflowGraph,
  type SerializedGraphWorkflowNode,
} from "./graph-workflow-types.js";

export class GraphWorkflowSerializerError extends Error {
  constructor(
    public readonly code:
      | "invalid_sidecar"
      | "missing_variant"
      | "missing_template"
      | "empty_graph",
    message: string,
  ) {
    super(message);
    this.name = "GraphWorkflowSerializerError";
  }
}

const FROZEN_EXPORT_STATUS: ExecutionStatus = "ready";

export function findGraphRootNode(graph: ExecutionGraph): ExecutionGraphNode | undefined {
  const roots = graph.nodes.filter((node) => !node.parentId);
  return roots.find((node) => node.id === "root-composer") ?? roots[0];
}

export function rootPromptSuitableForPipeline(graph: ExecutionGraph): boolean {
  const root = findGraphRootNode(graph);
  const prompt = (root?.prompt ?? root?.label ?? "").trim();
  return prompt.length > 0 && !prompt.includes("{{input}}");
}

export function defaultSaveVariant(graph: ExecutionGraph): GraphWorkflowSaveVariant {
  return rootPromptSuitableForPipeline(graph) ? "both" : "playbook";
}

export function serializeNodeForExport(node: ExecutionGraphNode): SerializedGraphWorkflowNode {
  return {
    id: node.id,
    parentId: node.parentId,
    kind: node.kind,
    position: node.position ? { ...node.position } : undefined,
    composer: node.composer ? structuredClone(node.composer) : undefined,
    label: node.label,
    prompt: node.prompt,
    originalPrompt: node.originalPrompt,
    plannedModel: node.plannedModel,
    modelOverride: node.modelOverride,
    modelOverrideSource: node.modelOverrideSource,
    expertAgentId: node.expertAgentId,
    expertAssignmentMode: node.expertAssignmentMode,
    expertRuntime: node.expertRuntime,
    expertToolAllowlist: node.expertToolAllowlist ? [...node.expertToolAllowlist] : undefined,
    expertPurposeTiers: node.expertPurposeTiers ? { ...node.expertPurposeTiers } : undefined,
    samplingOverride: node.samplingOverride ? { ...node.samplingOverride } : undefined,
    editableFields: node.editableFields ? [...node.editableFields] : undefined,
    depth: node.depth,
  };
}

function serializeGraphForExport(graph: ExecutionGraph): SerializedGraphWorkflowGraph {
  return {
    nodes: graph.nodes.map(serializeNodeForExport),
    edges: graph.edges.map((edge) => ({ ...edge })),
    viewport: graph.viewport ? { ...graph.viewport } : undefined,
  };
}

function createPipelineGraphFromPlaybook(
  playbook: SerializedGraphWorkflowGraph,
): SerializedGraphWorkflowGraph {
  const root = findGraphRootNode(playbook as ExecutionGraph);
  if (!root) {
    throw new GraphWorkflowSerializerError("empty_graph", "Graph has no root node.");
  }

  return {
    ...playbook,
    nodes: playbook.nodes.map((node) => {
      if (node.id !== root.id) {
        return { ...node };
      }
      return {
        ...node,
        prompt: "{{input}}",
        originalPrompt: node.prompt ?? node.label,
        composer: node.composer
          ? {
              ...node.composer,
              prompt: "{{input}}",
            }
          : undefined,
      };
    }),
  };
}

export function exportSessionGraphToSidecar(input: GraphWorkflowExportInput): GraphWorkflowSidecar {
  if (input.graph.nodes.length === 0) {
    throw new GraphWorkflowSerializerError("empty_graph", "Cannot export an empty graph.");
  }

  const playbookGraph = serializeGraphForExport(input.graph);
  const sidecar: GraphWorkflowSidecar = {
    kind: "graph",
    schemaVersion: GRAPH_WORKFLOW_SCHEMA_VERSION,
    graphId: input.workflowId,
    updatedAt: new Date().toISOString(),
    description: input.description,
    variants: {},
  };

  if (input.variant === "playbook" || input.variant === "both") {
    sidecar.variants.playbook = { graph: playbookGraph };
  }
  if (input.variant === "pipeline" || input.variant === "both") {
    sidecar.variants.pipeline = { graph: createPipelineGraphFromPlaybook(playbookGraph) };
  }

  return sidecar;
}

function deserializeNode(node: SerializedGraphWorkflowNode): ExecutionGraphNode {
  const result: ExecutionGraphNode = {
    id: node.id,
    kind: node.kind,
    label: node.label,
    depth: node.depth,
    status: FROZEN_EXPORT_STATUS,
  };
  if (node.parentId !== undefined) result.parentId = node.parentId;
  if (node.position !== undefined) result.position = node.position;
  if (node.composer !== undefined) result.composer = node.composer;
  if (node.prompt !== undefined) result.prompt = node.prompt;
  if (node.originalPrompt !== undefined) result.originalPrompt = node.originalPrompt;
  if (node.plannedModel !== undefined) result.plannedModel = node.plannedModel;
  if (node.modelOverride !== undefined) result.modelOverride = node.modelOverride;
  if (node.modelOverrideSource !== undefined) result.modelOverrideSource = node.modelOverrideSource;
  if (node.expertAgentId !== undefined) result.expertAgentId = node.expertAgentId;
  if (node.expertAssignmentMode !== undefined)
    result.expertAssignmentMode = node.expertAssignmentMode;
  if (node.expertRuntime !== undefined) result.expertRuntime = node.expertRuntime;
  if (node.expertToolAllowlist !== undefined) result.expertToolAllowlist = node.expertToolAllowlist;
  if (node.expertPurposeTiers !== undefined) result.expertPurposeTiers = node.expertPurposeTiers;
  if (node.samplingOverride !== undefined) result.samplingOverride = node.samplingOverride;
  if (node.editableFields !== undefined) result.editableFields = node.editableFields;
  return result;
}

function deserializeGraph(serialized: SerializedGraphWorkflowGraph): ExecutionGraph {
  return {
    nodes: serialized.nodes.map(deserializeNode),
    edges: serialized.edges.map((edge) => ({ ...edge })),
    viewport: serialized.viewport ? { ...serialized.viewport } : undefined,
  };
}

export function parseGraphWorkflowSidecar(raw: unknown): GraphWorkflowSidecar {
  if (!raw || typeof raw !== "object") {
    throw new GraphWorkflowSerializerError("invalid_sidecar", "Sidecar must be a YAML mapping.");
  }

  const doc = raw as Record<string, unknown>;
  if (doc["kind"] !== "graph") {
    throw new GraphWorkflowSerializerError("invalid_sidecar", 'Sidecar kind must be "graph".');
  }

  const schemaVersion = doc["schemaVersion"];
  if (typeof schemaVersion !== "number" || !Number.isInteger(schemaVersion)) {
    throw new GraphWorkflowSerializerError(
      "invalid_sidecar",
      "Sidecar schemaVersion must be an integer.",
    );
  }

  const graphId = doc["graphId"];
  if (typeof graphId !== "string" || graphId.trim().length === 0) {
    throw new GraphWorkflowSerializerError(
      "invalid_sidecar",
      "Sidecar graphId must be a non-empty string.",
    );
  }

  const updatedAt = doc["updatedAt"];
  if (typeof updatedAt !== "string" || updatedAt.trim().length === 0) {
    throw new GraphWorkflowSerializerError(
      "invalid_sidecar",
      "Sidecar updatedAt must be a non-empty string.",
    );
  }

  const variantsRaw = doc["variants"];
  if (!variantsRaw || typeof variantsRaw !== "object") {
    throw new GraphWorkflowSerializerError(
      "invalid_sidecar",
      "Sidecar variants must be a mapping.",
    );
  }

  const variants: GraphWorkflowSidecar["variants"] = {};
  for (const key of ["playbook", "pipeline"] as const) {
    const variantRaw = (variantsRaw as Record<string, unknown>)[key];
    if (!variantRaw) {
      continue;
    }
    if (typeof variantRaw !== "object") {
      throw new GraphWorkflowSerializerError(
        "invalid_sidecar",
        `Variant "${key}" must be a mapping.`,
      );
    }
    const graphRaw = (variantRaw as Record<string, unknown>)["graph"];
    if (!graphRaw || typeof graphRaw !== "object") {
      throw new GraphWorkflowSerializerError(
        "invalid_sidecar",
        `Variant "${key}" is missing graph.`,
      );
    }
    const graphDoc = graphRaw as Record<string, unknown>;
    const nodes = graphDoc["nodes"];
    const edges = graphDoc["edges"];
    if (!Array.isArray(nodes)) {
      throw new GraphWorkflowSerializerError(
        "invalid_sidecar",
        `Variant "${key}" graph.nodes must be an array.`,
      );
    }
    if (!Array.isArray(edges)) {
      throw new GraphWorkflowSerializerError(
        "invalid_sidecar",
        `Variant "${key}" graph.edges must be an array.`,
      );
    }
    variants[key] = {
      graph: {
        nodes: nodes as SerializedGraphWorkflowNode[],
        edges: edges as SerializedGraphWorkflowGraph["edges"],
        viewport: graphDoc["viewport"] as SerializedGraphWorkflowGraph["viewport"],
      },
    };
  }

  if (!variants.playbook && !variants.pipeline) {
    throw new GraphWorkflowSerializerError(
      "invalid_sidecar",
      "Sidecar must include playbook and/or pipeline variant.",
    );
  }

  const description = doc["description"];
  return {
    kind: "graph",
    schemaVersion,
    graphId: graphId.trim(),
    updatedAt: updatedAt.trim(),
    description: typeof description === "string" ? description : undefined,
    variants,
  };
}

export function importSidecarToGraph(
  sidecar: GraphWorkflowSidecar,
  variant: GraphWorkflowVariant,
): GraphWorkflowImportResult {
  const variantGraph =
    sidecar.variants[variant]?.graph ??
    (variant === "playbook" ? sidecar.variants.pipeline?.graph : sidecar.variants.playbook?.graph);
  if (!variantGraph) {
    throw new GraphWorkflowSerializerError(
      "missing_variant",
      `Graph workflow "${sidecar.graphId}" does not include variant "${variant}".`,
    );
  }

  return {
    graph: deserializeGraph(variantGraph),
    sidecar,
    variant,
  };
}

export function applyPipelineTemplate(
  graph: ExecutionGraph,
  input: { input: string },
): ExecutionGraph {
  const root = findGraphRootNode(graph);
  if (!root) {
    throw new GraphWorkflowSerializerError("empty_graph", "Graph has no root node.");
  }

  const templateValue = input.input;
  return {
    ...graph,
    nodes: graph.nodes.map((node) => {
      if (node.id !== root.id) {
        return node;
      }
      const prompt = (node.prompt ?? node.label).replace(/\{\{input\}\}/g, templateValue);
      return {
        ...node,
        prompt,
        label: node.label.replace(/\{\{input\}\}/g, templateValue),
        composer: node.composer
          ? {
              ...node.composer,
              prompt: (node.composer.prompt ?? node.prompt ?? node.label).replace(
                /\{\{input\}\}/g,
                templateValue,
              ),
            }
          : undefined,
      };
    }),
  };
}

export function graphHasPipelineTemplate(graph: ExecutionGraph): boolean {
  const root = findGraphRootNode(graph);
  const prompt = root?.prompt ?? root?.composer?.prompt ?? root?.label ?? "";
  return prompt.includes("{{input}}");
}

export function buildImportSessionSnapshot(graph: ExecutionGraph): {
  graph: ExecutionGraph;
  status: "planned";
  approvalMode: "initial-plan-recursive";
  autoApprovalPaused: boolean;
  chat: {
    readiness: { state: "draft"; reason: string };
    clarificationHistory: [];
  };
} {
  return {
    graph,
    status: "planned",
    approvalMode: "initial-plan-recursive",
    autoApprovalPaused: false,
    chat: {
      readiness: {
        state: "draft",
        reason: "Imported graph workflow: review and run when ready.",
      },
      clarificationHistory: [],
    },
  };
}
