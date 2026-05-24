import type { ExecutionStatus } from "./types";

/** Mirror `ExecutionStatus` display strings in `crates/rlm-core/src/domain/types.rs` for header copy. */
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
