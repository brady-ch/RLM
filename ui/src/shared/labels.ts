import type { ExecutionStatus } from "./types";

/** Mirror `labelForCategory` / status strings in `src/domain/execution-failure.ts` for header copy. */
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
