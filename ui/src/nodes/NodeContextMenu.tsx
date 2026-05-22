import React, { useEffect, useRef } from "react";
import type { ExecutionNode } from "../shared/types";
import { formatPlanningError, post, runAction } from "../shared/api";

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

  if (!open || !setErrorMessage || !refresh) {
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

  return (
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
          onClick={() => run(() => post(`/api/nodes/${encodeURIComponent(node.id)}/breakdown`, {}))}
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
              post(`/api/nodes/${encodeURIComponent(node.id)}/skip`, { token: node.approvalToken }),
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
          onClick={() => {
            const newChildPrompt = window.prompt("New child prompt");
            if (newChildPrompt?.trim()) {
              run(() =>
                post("/api/nodes/add", { parentId: node.id, prompt: newChildPrompt.trim() }),
              );
            }
          }}
        >
          Add child…
        </button>
        <button
          type="button"
          role="menuitem"
          disabled={!editable}
          onClick={() => {
            const parentId = window.prompt("Parent node ID");
            if (parentId?.trim()) {
              run(() =>
                post(`/api/nodes/${encodeURIComponent(node.id)}/connect`, {
                  parentId: parentId.trim(),
                }),
              );
            }
          }}
        >
          Connect parent…
        </button>
        <button
          type="button"
          role="menuitem"
          disabled={!editable}
          onClick={() => {
            if (window.confirm(`Delete subtree for ${node.label || node.id}?`)) {
              run(() => post(`/api/nodes/${encodeURIComponent(node.id)}/delete`, {}));
            }
          }}
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
  );
}
