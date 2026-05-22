import { Square } from "lucide-react";
import type { ExecutionNode, SessionSnapshot } from "../shared/types";
import { uiRunStatusLabels } from "../shared/labels";
import { approvalModeLabel, post, runAction } from "../shared/api";

export type TopBarProps = {
  snapshot: SessionSnapshot;
  runVariant: "playbook" | "pipeline";
  pipelineInput: string;
  activeRunVariant: "playbook" | "pipeline" | undefined;
  setActiveRunVariant: (variant: "playbook" | "pipeline" | undefined) => void;
  onAdvanced: () => void;
  refresh: () => Promise<void>;
  setErrorMessage: (message: string | undefined) => void;
};

export function TopBar({
  snapshot,
  runVariant,
  pipelineInput,
  activeRunVariant,
  setActiveRunVariant,
  onAdvanced,
  refresh,
  setErrorMessage,
}: TopBarProps) {
  const activeNode: ExecutionNode | undefined = snapshot.activeNodeId
    ? snapshot.graph.nodes.find((node) => node.id === snapshot.activeNodeId)
    : undefined;

  return (
    <header className="workflow-topbar">
      <div className="run-status-block" aria-live="polite">
        <span className={`status ${snapshot.status}`} title={snapshot.runSummary?.message}>
          {uiRunStatusLabels[snapshot.status] ?? snapshot.status}
        </span>
        {snapshot.status === "running" ? (
          <span className="meta-pill run-variant-pill">Running {activeRunVariant ?? runVariant}</span>
        ) : null}
        {activeNode ? (
          <span className="run-active-node">
            Running: {activeNode.label} ({activeNode.expertAgentId ?? "default"},{" "}
            {activeNode.expertRuntime ?? "single-pass"})
          </span>
        ) : null}
        {snapshot.status === "failed" && snapshot.runSummary?.message ? (
          <span className="run-failure-hint">Run stopped: {snapshot.runSummary.message}</span>
        ) : null}
      </div>
      <span className="meta-pill">{approvalModeLabel(snapshot.approvalMode)}</span>
      {snapshot.status === "running" &&
      snapshot.approvalMode === "initial-plan-recursive" ? (
        <button
          type="button"
          className="secondary"
          disabled={snapshot.autoApprovalPaused}
          aria-label="Pause future auto-approvals"
          onClick={() =>
            runAction(
              setErrorMessage,
              () => post("/api/pause-future-auto-approvals"),
              refresh,
            )
          }
        >
          Pause future auto-approvals
        </button>
      ) : null}
      <button
        type="button"
        className="btn-run-primary"
        aria-label="Run workflow"
        onClick={() =>
          runAction(
            setErrorMessage,
            async () => {
              setActiveRunVariant(runVariant);
              await post("/api/chat/confirm-run", {
                variant: runVariant,
                input: runVariant === "pipeline" ? pipelineInput : undefined,
              });
            },
            refresh,
          )
        }
      >
        Run workflow
      </button>
      <button
        className="icon danger"
        title="Stop run"
        aria-label="Stop run"
        onClick={() =>
          runAction(setErrorMessage, () => post("/api/stop", { reason: "stopped from UI" }), refresh)
        }
      >
        <Square size={16} aria-hidden />
        Stop
      </button>
      <button type="button" className="secondary" onClick={onAdvanced}>
        Advanced
      </button>
    </header>
  );
}
