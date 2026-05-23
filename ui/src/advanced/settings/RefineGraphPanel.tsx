import React from "react";
import type { SessionSnapshot } from "../../shared/types";
import { deleteStrategyLabel, post, runAction } from "../../shared/api";
export function RefineGraphPanel({
  collapsedByDefault,
  chatMessage,
  setChatMessage,
  pendingMutation,
  deleteStrategy,
  setDeleteStrategy,
  refresh,
  setErrorMessage,
}: {
  collapsedByDefault: boolean;
  chatMessage: string;
  setChatMessage: (value: string) => void;
  pendingMutation: NonNullable<SessionSnapshot["chat"]>["pendingMutation"];
  deleteStrategy: "delete_subtree" | "rewire_dependents";
  setDeleteStrategy: (value: "delete_subtree" | "rewire_dependents") => void;
  refresh: () => Promise<void>;
  setErrorMessage: (message: string | undefined) => void;
}) {
  return (
    <details className="session-panel chat-refine-panel" open={!collapsedByDefault}>
      <summary>Refine graph (optional secondary)</summary>
      <div className="meta-row">
        Graph node submit is the default authoring path. Use chat only to preview edits after
        planning.
      </div>
      <textarea
        value={chatMessage}
        onChange={(event) => setChatMessage(event.target.value)}
        placeholder="edit task-1: refine this prompt"
        aria-label="Optional graph refinement chat"
      />
      <div className="actions">
        <button
          disabled={chatMessage.trim().length === 0}
          onClick={() =>
            runAction(
              setErrorMessage,
              () => post("/api/chat/message", { message: chatMessage }),
              refresh,
            )
          }
        >
          Preview mutation
        </button>
        <button
          onClick={() => runAction(setErrorMessage, () => post("/api/chat/cancel", {}), refresh)}
        >
          Clear preview
        </button>
      </div>
      {pendingMutation ? (
        <div className="meta-row">
          Pending: {pendingMutation.summary}
          {pendingMutation.requiresDeleteChoice && pendingMutation.pendingDeleteChoice ? (
            <div className="actions">
              <select
                value={deleteStrategy}
                onChange={(event) =>
                  setDeleteStrategy(event.target.value as "delete_subtree" | "rewire_dependents")
                }
              >
                {pendingMutation.pendingDeleteChoice.options.map((option) => (
                  <option key={option} value={option}>
                    {deleteStrategyLabel(option)}
                  </option>
                ))}
              </select>
              <button
                onClick={() =>
                  runAction(
                    setErrorMessage,
                    () =>
                      post("/api/chat/apply", { proposalId: pendingMutation.id, deleteStrategy }),
                    refresh,
                  )
                }
              >
                Apply preview
              </button>
            </div>
          ) : (
            <div className="actions">
              <button
                onClick={() =>
                  runAction(
                    setErrorMessage,
                    () => post("/api/chat/apply", { proposalId: pendingMutation.id }),
                    refresh,
                  )
                }
              >
                Apply preview
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="meta-row">No pending mutation preview.</div>
      )}
    </details>
  );
}
