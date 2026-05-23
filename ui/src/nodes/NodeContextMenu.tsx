import React, { useState } from "react";
import * as ContextMenu from "@radix-ui/react-context-menu";
import type { ExecutionNode } from "../shared/types";
import { formatPlanningError, post, runAction } from "../shared/api";
import { GraphActionModal } from "./GraphActionModal";

export type NodeContextMenuShellProps = {
  node: ExecutionNode;
  prompt: string;
  children: React.ReactNode;
  setErrorMessage?: (message: string | undefined) => void;
  refresh?: () => Promise<void>;
  setPlanningNodeId?: (nodeId: string | undefined) => void;
  setPlanningError?: (error: { nodeId: string; message: string } | undefined) => void;
  onNavigateAdvancedSettings?: () => void;
};

export function NodeContextMenuShell({
  node,
  prompt,
  children,
  setErrorMessage,
  refresh,
  setPlanningNodeId,
  setPlanningError,
  onNavigateAdvancedSettings,
}: NodeContextMenuShellProps) {
  const [graphModal, setGraphModal] = useState<
    null | { kind: "add-child" } | { kind: "connect-parent" } | { kind: "delete-subtree" }
  >(null);

  if (!setErrorMessage || !refresh) {
    return <>{children}</>;
  }

  const editable =
    node.status === "planned" || node.status === "ready" || node.status === "awaiting_approval";
  const waiting = node.status === "awaiting_approval";
  const exhausted = node.composer?.planBudget.exhausted === true;

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
      }
    })();
  };

  const run = (operation: () => Promise<void>) => {
    void runAction(setErrorMessage, operation, refresh);
  };

  const closeGraphModal = () => setGraphModal(null);

  return (
    <>
      <ContextMenu.Root>
        <ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Content className="radix-context-menu" sideOffset={4} alignOffset={4}>
            <ContextMenu.Label className="radix-context-menu-label">Plan</ContextMenu.Label>
            <ContextMenu.Item
              className="radix-context-menu-item"
              disabled={!editable}
              onSelect={planChildren}
            >
              Plan children
            </ContextMenu.Item>
            <ContextMenu.Item
              className="radix-context-menu-item"
              disabled={!editable}
              onSelect={() => run(() => post(`/api/nodes/${encodeURIComponent(node.id)}/breakdown`, {}))}
            >
              Break down
            </ContextMenu.Item>
            <ContextMenu.Item
              className="radix-context-menu-item"
              disabled={!editable || !exhausted}
              onSelect={() =>
                run(() => post(`/api/nodes/${encodeURIComponent(node.id)}/extend-budget`, {}))
              }
            >
              Extend budget
            </ContextMenu.Item>
            <ContextMenu.Separator className="radix-context-menu-separator" />
            <ContextMenu.Label className="radix-context-menu-label">Run</ContextMenu.Label>
            <ContextMenu.Item
              className="radix-context-menu-item"
              disabled={!waiting}
              onSelect={() =>
                run(() =>
                  post(`/api/nodes/${encodeURIComponent(node.id)}/approve`, {
                    token: node.approvalToken,
                  }),
                )
              }
            >
              Approve
            </ContextMenu.Item>
            <ContextMenu.Item
              className="radix-context-menu-item"
              disabled={!waiting}
              onSelect={() =>
                run(() =>
                  post(`/api/nodes/${encodeURIComponent(node.id)}/skip`, {
                    token: node.approvalToken,
                  }),
                )
              }
            >
              Skip
            </ContextMenu.Item>
            <ContextMenu.Separator className="radix-context-menu-separator" />
            <ContextMenu.Label className="radix-context-menu-label">Graph</ContextMenu.Label>
            <ContextMenu.Item
              className="radix-context-menu-item"
              disabled={!editable}
              onSelect={() => setGraphModal({ kind: "add-child" })}
            >
              Add child…
            </ContextMenu.Item>
            <ContextMenu.Item
              className="radix-context-menu-item"
              disabled={!editable}
              onSelect={() => setGraphModal({ kind: "connect-parent" })}
            >
              Connect parent…
            </ContextMenu.Item>
            <ContextMenu.Item
              className="radix-context-menu-item"
              disabled={!editable}
              onSelect={() => setGraphModal({ kind: "delete-subtree" })}
            >
              Delete subtree
            </ContextMenu.Item>
            <ContextMenu.Separator className="radix-context-menu-separator" />
            <ContextMenu.Label className="radix-context-menu-label">Advanced</ContextMenu.Label>
            <ContextMenu.Item
              className="radix-context-menu-item"
              onSelect={() => onNavigateAdvancedSettings?.()}
            >
              Expert overrides…
            </ContextMenu.Item>
          </ContextMenu.Content>
        </ContextMenu.Portal>
      </ContextMenu.Root>
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

/** @deprecated Use NodeContextMenuShell — kept for shell-boundaries import name */
export const NodeContextMenu = NodeContextMenuShell;

export function openNodeContextMenuFromButton(event: React.MouseEvent<HTMLElement>): void {
  event.stopPropagation();
  event.currentTarget.dispatchEvent(
    new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: event.clientX,
      clientY: event.clientY,
    }),
  );
}
