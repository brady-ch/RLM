import React, { useEffect, useRef, useState } from "react";
import type { ExecutionNode } from "../shared/types";
import { formatPlanningError, post, runAction } from "../shared/api";
import { GraphActionModal } from "./GraphActionModal";

export type NodeContextMenuProps = {
  node: ExecutionNode;
  prompt: string;
  open: boolean;
  x: number;
  y: number;
  onClose: () => void;
  setErrorMessage?: (message: string | undefined) => void;
  refresh?: () => Promise<void>;
  setPlanningNodeId?: (nodeId: string | undefined) => void;
  setPlanningError?: (error: { nodeId: string; message: string } | undefined) => void;
  onNavigateAdvancedSettings?: () => void;
};

export function NodeContextMenu({
  node,
  prompt,
  open,
  x,
  y,
  onClose,
  setErrorMessage,
  refresh,
  setPlanningNodeId,
  setPlanningError,
  onNavigateAdvancedSettings,
}: NodeContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [graphModal, setGraphModal] = useState<
    null | { kind: "add-child" } | { kind: "connect-parent" } | { kind: "delete-subtree" }
  >(null);
  const editable =
    node.status === "planned" || node.status === "ready" || node.status === "awaiting_approval";
  const waiting = node.status === "awaiting_approval";
  const exhausted = node.composer?.planBudget.exhausted === true;

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    const onPointer = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointer);
    };
  }, [open, onClose]);

  if (!setErrorMessage || !refresh) {
    return null;
  }

  const showMenu = open;
  const showGraphModal = graphModal !== null;

  if (!showMenu && !showGraphModal) {
    return null;
  }

  const planChildren = () => {
    void (async () => {
      setPlanningError?.(undefined);
      setPlanningNodeId?.(node.id);
      try {
        await post(`/api/nodes/${encodeURIComponent(node.id)}/edit`, { prompt });
        await post(`/api/nodes/${encodeURIComponent(node.id)}/plan`, {});
      } catch (error) {
        const message = formatPlanningError(error instanceof Error ? error.message : String(error));
        setErrorMessage(message);
        setPlanningError?.({ nodeId: node.id, message });
      } finally {
        setPlanningNodeId?.(undefined);
        await refresh();
        onClose();
      }
    })();
  };

  const run = (operation: () => Promise<void>) => {
    void runAction(setErrorMessage, operation, async () => {
      await refresh();
      onClose();
    });
  };

  const closeGraphModal = () => setGraphModal(null);

  return (
    <>
      {showMenu ? (
        <div
          ref={menuRef}
          className="node-context-menu"
          role="menu"
          style={{ position: "fixed", top: y, left: x, zIndex: 1000 }}
        >
          <div className="node-context-menu-section" role="presentation">
            <span className="node-context-menu-label">Plan</span>
            <button type="button" role="menuitem" disabled={!editable} onClick={planChildren}>
              Plan children
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={!editable}
              onClick={() =>
                run(() => post(`/api/nodes/${encodeURIComponent(node.id)}/breakdown`, {}))
              }
            >
              Break down
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={!editable || !exhausted}
              onClick={() =>
                run(() => post(`/api/nodes/${encodeURIComponent(node.id)}/extend-budget`, {}))
              }
            >
              Extend budget
            </button>
          </div>
          <div className="node-context-menu-section" role="presentation">
            <span className="node-context-menu-label">Run</span>
            <button
              type="button"
              role="menuitem"
              disabled={!waiting}
              onClick={() =>
                run(() =>
                  post(`/api/nodes/${encodeURIComponent(node.id)}/approve`, {
                    token: node.approvalToken,
                  }),
                )
              }
            >
              Approve
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={!waiting}
              onClick={() =>
                run(() =>
                  post(`/api/nodes/${encodeURIComponent(node.id)}/skip`, {
                    token: node.approvalToken,
                  }),
                )
              }
            >
              Skip
            </button>
          </div>
          <div className="node-context-menu-section" role="presentation">
            <span className="node-context-menu-label">Graph</span>
            <button
              type="button"
              role="menuitem"
              disabled={!editable}
              onClick={() => setGraphModal({ kind: "add-child" })}
            >
              Add child…
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={!editable}
              onClick={() => setGraphModal({ kind: "connect-parent" })}
            >
              Connect parent…
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={!editable}
              onClick={() => setGraphModal({ kind: "delete-subtree" })}
            >
              Delete subtree
            </button>
          </div>
          <div className="node-context-menu-section" role="presentation">
            <span className="node-context-menu-label">Advanced</span>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onNavigateAdvancedSettings?.();
                onClose();
              }}
            >
              Expert overrides…
            </button>
          </div>
        </div>
      ) : null}
      <GraphActionModal
        open={graphModal?.kind === "add-child"}
        mode="prompt"
        title="Add child node"
        inputLabel="New child prompt"
        inputPlaceholder="Describe the child task"
        confirmLabel="Add child"
        onCancel={closeGraphModal}
        onSubmit={(newChildPrompt) => {
          closeGraphModal();
          run(() => post("/api/nodes/add", { parentId: node.id, prompt: newChildPrompt }));
        }}
      />
      <GraphActionModal
        open={graphModal?.kind === "connect-parent"}
        mode="prompt"
        title="Connect parent"
        inputLabel="Parent node ID"
        inputPlaceholder="node-id"
        confirmLabel="Connect"
        onCancel={closeGraphModal}
        onSubmit={(parentId) => {
          closeGraphModal();
          run(() =>
            post(`/api/nodes/${encodeURIComponent(node.id)}/connect`, {
              parentId,
            }),
          );
        }}
      />
      <GraphActionModal
        open={graphModal?.kind === "delete-subtree"}
        mode="confirm"
        title="Delete subtree"
        description={`Delete subtree for ${node.label || node.id}? This cannot be undone.`}
        confirmLabel="Delete"
        onCancel={closeGraphModal}
        onSubmit={() => {
          closeGraphModal();
          run(() => post(`/api/nodes/${encodeURIComponent(node.id)}/delete`, {}));
        }}
      />
    </>
  );
}
