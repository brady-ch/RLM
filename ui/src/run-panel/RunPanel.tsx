import type { ExecutionNode, SessionSnapshot } from "../shared/types";
import { post, runAction } from "../shared/api";

export type RunPanelProps = {
  selectedNode: ExecutionNode | undefined;
  snapshot: SessionSnapshot;
  clarificationAnswer: string;
  setClarificationAnswer: (value: string) => void;
  runDisabled: boolean;
  readinessReason: string;
  refresh: () => Promise<void>;
  setErrorMessage: (message: string | undefined) => void;
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
}: RunPanelProps) {
  if (!selectedNode) {
    return null;
  }

  const pendingClarification = snapshot.chat?.pendingClarification;
  const waiting = selectedNode.status === "awaiting_approval";

  return (
    <aside className="run-panel" aria-label="Run panel">
      <header className="run-panel-header">
        <h2>
          {selectedNode.label} · {selectedNode.id} · {selectedNode.status}
        </h2>
      </header>
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
