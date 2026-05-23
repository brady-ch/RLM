import type { ExecutionNode, SessionSnapshot } from "../shared/types";
import { uiRunStatusLabels } from "../shared/labels";
import { post, runAction } from "../shared/api";
import { WorkflowOverview } from "./WorkflowOverview";

export type RunPanelProps = {
  selectedNode: ExecutionNode | undefined;
  snapshot: SessionSnapshot;
  clarificationAnswer: string;
  setClarificationAnswer: (value: string) => void;
  runDisabled: boolean;
  readinessReason: string;
  refresh: () => Promise<void>;
  setErrorMessage: (message: string | undefined) => void;
  onSelectNode: (nodeId: string | undefined) => void;
  onFitGraph: () => void;
};

export function RunPanel({
  selectedNode,
  snapshot,
  clarificationAnswer,
  setClarificationAnswer,
  runDisabled,
  readinessReason,
  refresh,
  setErrorMessage,
  onSelectNode,
  onFitGraph,
}: RunPanelProps) {
  if (!selectedNode) {
    return (
      <aside className="run-panel" aria-label="Workflow overview" data-testid="run-panel">
        <WorkflowOverview
          snapshot={snapshot}
          onSelectNode={onSelectNode}
          onFitGraph={onFitGraph}
        />
      </aside>
    );
  }

  const pendingClarification = snapshot.chat?.pendingClarification;
  const waiting = selectedNode.status === "awaiting_approval";
  const nodePrompt = selectedNode.prompt?.trim();

  return (
    <aside className="run-panel" aria-label="Run panel" data-testid="run-panel">
      <header className="run-panel-header">
        <h2>
          {selectedNode.label} · {selectedNode.id} ·{" "}
          {uiRunStatusLabels[selectedNode.status] ?? selectedNode.status}
        </h2>
        <button type="button" className="run-panel-back" onClick={() => onSelectNode(undefined)}>
          Back to overview
        </button>
      </header>
      {nodePrompt ? (
        <div className="run-panel-prompt">
          <label>Prompt</label>
          <p>{nodePrompt}</p>
        </div>
      ) : null}
      {selectedNode.approvalReason ? (
        <div className="run-panel-detail">
          <label>{selectedNode.status === "failed" ? "Failure reason" : "Result note"}</label>
          <p>{selectedNode.approvalReason}</p>
        </div>
      ) : null}
      {runDisabled ? (
        <div className="run-panel-readiness">
          <label>Readiness</label>
          <p>{readinessReason}</p>
        </div>
      ) : null}
      {waiting ? (
        <div className="run-panel-actions">
          <button
            type="button"
            onClick={() =>
              runAction(
                setErrorMessage,
                () =>
                  post(`/api/nodes/${encodeURIComponent(selectedNode.id)}/approve`, {
                    token: selectedNode.approvalToken,
                  }),
                refresh,
              )
            }
          >
            Approve
          </button>
          <button
            type="button"
            onClick={() =>
              runAction(
                setErrorMessage,
                () =>
                  post(`/api/nodes/${encodeURIComponent(selectedNode.id)}/skip`, {
                    token: selectedNode.approvalToken,
                  }),
                refresh,
              )
            }
          >
            Skip
          </button>
        </div>
      ) : null}
      {pendingClarification?.nodeId === selectedNode.id ? (
        <div className="run-panel-clarification">
          <p>{pendingClarification.promptText}</p>
          <textarea
            value={clarificationAnswer}
            onChange={(event) => setClarificationAnswer(event.target.value)}
            placeholder="Type clarification answer"
            aria-label="Clarification answer"
          />
          <div className="actions">
            <button
              type="button"
              disabled={clarificationAnswer.trim().length === 0}
              onClick={() =>
                runAction(
                  setErrorMessage,
                  () =>
                    post("/api/clarifications/answer", {
                      questionId: pendingClarification.questionId,
                      userAnswer: clarificationAnswer,
                    }),
                  async () => {
                    setClarificationAnswer("");
                    await refresh();
                  },
                )
              }
            >
              Submit answer
            </button>
            <button
              type="button"
              className="danger"
              onClick={() =>
                runAction(
                  setErrorMessage,
                  () =>
                    post("/api/clarifications/abort", {
                      questionId: pendingClarification.questionId,
                    }),
                  refresh,
                )
              }
            >
              Abort run
            </button>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
