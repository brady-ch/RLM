import type {
  ExecutionGraph,
  ExecutionGraphEdge,
  ExecutionGraphNode,
  ExpertAssignmentMode,
  ExpertRuntimeMode,
  NodeComposer,
} from "../domain/types.js";
import type { LanguageModelPurpose } from "../ports/language-model-port.js";

export const GRAPH_WORKFLOW_SCHEMA_VERSION = 1;

export type GraphWorkflowVariant = "playbook" | "pipeline";
export type GraphWorkflowSaveVariant = GraphWorkflowVariant | "both";

export interface SerializedGraphWorkflowNode {
  id: string;
  parentId?: string | undefined;
  kind: ExecutionGraphNode["kind"];
  position?: { x: number; y: number } | undefined;
  composer?: NodeComposer | undefined;
  label: string;
  prompt?: string | undefined;
  originalPrompt?: string | undefined;
  plannedModel?: string | undefined;
  modelOverride?: string | undefined;
  modelOverrideSource?: "user" | "none" | undefined;
  expertAgentId?: string | undefined;
  expertAssignmentMode?: ExpertAssignmentMode | undefined;
  expertRuntime?: ExpertRuntimeMode | undefined;
  expertToolAllowlist?: string[] | undefined;
  expertPurposeTiers?: Partial<Record<LanguageModelPurpose, string>> | undefined;
  samplingOverride?: ExecutionGraphNode["samplingOverride"];
  editableFields?: Array<"prompt"> | undefined;
  depth: number;
}

export interface SerializedGraphWorkflowGraph {
  nodes: SerializedGraphWorkflowNode[];
  edges: ExecutionGraphEdge[];
  viewport?: ExecutionGraph["viewport"];
}

export interface GraphWorkflowSidecar {
  kind: "graph";
  schemaVersion: number;
  graphId: string;
  updatedAt: string;
  description?: string | undefined;
  variants: Partial<Record<GraphWorkflowVariant, { graph: SerializedGraphWorkflowGraph }>>;
}

export interface GraphWorkflowListEntry {
  id: string;
  path: string;
  description?: string | undefined;
  updatedAt: string;
  variants: GraphWorkflowVariant[];
}

export interface GraphWorkflowExportInput {
  workflowId: string;
  description?: string | undefined;
  variant: GraphWorkflowSaveVariant;
  graph: ExecutionGraph;
}

export interface GraphWorkflowImportResult {
  graph: ExecutionGraph;
  sidecar: GraphWorkflowSidecar;
  variant: GraphWorkflowVariant;
}
