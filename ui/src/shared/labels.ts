import type { ExecutionStatus } from "./types";

/** Mirror `ExecutionStatus` display strings in rlm-core domain types for header copy. */
export const uiRunStatusLabels: Record<ExecutionStatus, string> = {
  planned: "Planned",
  ready: "Ready",
  awaiting_approval: "Awaiting approval",
  approved: "Approved",
  running: "Running",
  completed: "Completed",
  skipped: "Skipped",
  failed: "Failed",
  cancelled: "Cancelled",
};
