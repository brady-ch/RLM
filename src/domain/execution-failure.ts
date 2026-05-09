/**
 * Failure vocabulary (D-06 / D-12): maps node-level statuses and error classes to
 * run-level terminal status and human labels. Keep codes stable for CLI, SSE, and UI.
 *
 * | Node mix (all terminal)              | Run terminal | Notes |
 * |--------------------------------------|----------------|-------|
 * | Any `failed`                         | `failed`       | Hard failure wins over partial skip |
 * | No `failed`, any `cancelled`         | `cancelled`    | User/system stop |
 * | Only `completed` / `skipped`         | `completed`    | Success |
 * | Non-terminal mix (running, etc.)     | (not terminal) | Caller uses active node / planned |
 *
 * Session snapshot adds precedence: `cancellation.isCancelled()` wins over `failed`
 * when both are true (run stopped after errors).
 */
import type { ExecutionGraphNode, ExecutionStatus } from "./types.js";

export type ExecutionFailureCategory =
  | "model"
  | "tool"
  | "workflow"
  | "validation"
  | "cancelled"
  | "internal";

/** Stable surface codes for clients (not exhaustive of every throw site). */
export const EXECUTION_FAILURE_CODES = {
  model: "MODEL_FAILURE",
  tool: "TOOL_FAILURE",
  workflow: "WORKFLOW_AGENT_FAILURE",
  validation: "VALIDATION_FAILURE",
  cancelled: "CANCELLED",
  internal: "INTERNAL_FAILURE",
  nodeFailed: "NODE_FAILED",
} as const;

export function labelForCategory(category: ExecutionFailureCategory): string {
  switch (category) {
    case "model":
      return "Model error";
    case "tool":
      return "Tool error";
    case "workflow":
      return "Workflow error";
    case "validation":
      return "Validation error";
    case "cancelled":
      return "Cancelled";
    case "internal":
      return "Execution error";
  }
}

export type NodeRunSummaryInput = Pick<ExecutionGraphNode, "status" | "id" | "label">;

export function summarizeRunFromNodes(nodes: NodeRunSummaryInput[]): {
  terminal: ExecutionStatus;
  primaryMessage?: string;
} {
  if (nodes.length === 0) {
    return { terminal: "planned" };
  }

  const terminalStates: ExecutionStatus[] = [
    "completed",
    "skipped",
    "failed",
    "cancelled",
  ];
  const allTerminal = nodes.every((node) => terminalStates.includes(node.status));
  if (!allTerminal) {
    const running = nodes.find((n) => n.status === "running" || n.status === "awaiting_approval");
    if (running) {
      return { terminal: running.status === "awaiting_approval" ? "awaiting_approval" : "running" };
    }
    return { terminal: "planned" };
  }

  if (nodes.some((node) => node.status === "failed")) {
    const failed = nodes.find((node) => node.status === "failed");
    const summary: { terminal: ExecutionStatus; primaryMessage?: string } = { terminal: "failed" };
    if (failed) {
      summary.primaryMessage = `${failed.label} (${failed.id})`;
    }
    return summary;
  }

  if (nodes.some((node) => node.status === "cancelled")) {
    return { terminal: "cancelled", primaryMessage: "Run was cancelled." };
  }

  return { terminal: "completed" };
}
