import React, { useEffect, useState } from "react";
import { Handle, Position } from "@xyflow/react";
import { AlertTriangle, GitBranchPlus } from "lucide-react";
import type { FlowNodeData } from "../shared/types";
import { formatPlanningError, post, truncateFailureMessage } from "../shared/api";
import { QualityLoopCardSummary } from "./QualityLoopCardSummary";
import { NodeContextMenu } from "./NodeContextMenu";

export function ExecutionNodeCard({ data }: { data: FlowNodeData }) {
  const node = data.execution;
  const composer = node.composer;
  const [prompt, setPrompt] = useState(node.prompt ?? "");
  const isPlanning = data.planningNodeId === node.id;
  const isActive = data.activeNodeId === node.id;
  const blockedByAncestor =
    node.status === "failed" && (node.approvalReason?.includes("ancestor") ?? false);
  const nodeFailureReason =
    node.status === "failed" && node.approvalReason
      ? truncateFailureMessage(node.approvalReason)
      : undefined;
  const planningError =
    data.planningErrorNodeId === node.id ? data.planningErrorMessage : undefined;
  const editable =
    node.status === "planned" || node.status === "ready" || node.status === "awaiting_approval";
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  useEffect(() => {
    setPrompt(node.prompt ?? "");
  }, [node.id, node.prompt]);

  const openMenu = (clientX: number, clientY: number) => {
    setMenuPos({ x: clientX, y: clientY });
    setMenuOpen(true);
  };

  const planChildren = () => {
    if (!data.setErrorMessage || !data.refresh || !data.setPlanningNodeId) {
      return;
    }
    void (async () => {
      data.setErrorMessage?.(undefined);
      data.setPlanningError?.(undefined);
      data.setPlanningNodeId?.(node.id);
      try {
        await post(`/api/nodes/${encodeURIComponent(node.id)}/edit`, { prompt });
        await post(`/api/nodes/${encodeURIComponent(node.id)}/plan`, {});
      } catch (error) {
        const message = formatPlanningError(error instanceof Error ? error.message : String(error));
        data.setErrorMessage?.(message);
        data.setPlanningError?.({ nodeId: node.id, message });
      } finally {
        data.setPlanningNodeId?.(undefined);
        await data.refresh?.();
      }
    })();
  };

  const chooseReplan = (choice: "replace" | "merge" | "cancel") => {
    if (!data.setErrorMessage || !data.refresh || !data.setPlanningNodeId) {
      return;
    }
    void (async () => {
      data.setErrorMessage?.(undefined);
      data.setPlanningError?.(undefined);
      data.setPlanningNodeId?.(node.id);
      try {
        await post(`/api/nodes/${encodeURIComponent(node.id)}/plan`, { replan: choice });
      } catch (error) {
        const message = formatPlanningError(error instanceof Error ? error.message : String(error));
        data.setErrorMessage?.(message);
        data.setPlanningError?.({ nodeId: node.id, message });
      } finally {
        data.setPlanningNodeId?.(undefined);
        await data.refresh?.();
      }
    })();
  };
  return (
    <div
      className={`node-card ${node.status} ${node.id === "root-composer" ? "root-composer-focus" : ""} ${isPlanning ? "planning-in-progress" : ""} ${isActive ? "active-execution" : ""} ${blockedByAncestor ? "blocked-by-ancestor" : ""} ${data.isSelected ? "node-card-selected" : ""}`}
      tabIndex={0}
      aria-busy={node.status === "running" || isPlanning ? "true" : undefined}
      onContextMenu={(event) => {
        event.preventDefault();
        openMenu(event.clientX, event.clientY);
      }}
      onKeyDown={(event) => {
        if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
          event.preventDefault();
          const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
          openMenu(rect.left + 8, rect.top + 8);
        }
      }}
    >
      {composer && composer.inputs.length > 0 ? (
        composer.inputs.map((port, i) => (
          <Handle
            key={port.id}
            id={port.id}
            className="node-port node-port-input"
            type="target"
            position={Position.Left}
            style={{ top: `${((i + 1) / (composer.inputs.length + 1)) * 100}%` }}
          />
        ))
      ) : (
        <Handle
          className="node-port node-port-input"
          id="in"
          type="target"
          position={Position.Left}
        />
      )}
      <div className="node-header">
        <div>
          <div className="node-type">{composer?.type ?? node.kind}</div>
          <div className="node-runtime">
            {node.status === "running" ? "Executing: " : ""}
            {node.expertRuntime ?? "single-pass"} · {node.expertAgentId ?? "default"} ·{" "}
            {node.status}
          </div>
        </div>
        <span className={`complexity ${composer?.complexity ?? "low"}`}>
          {composer?.complexity ?? "low"}
        </span>
        <button
          type="button"
          className="icon node-actions-trigger"
          aria-label="Actions"
          onClick={(event) => {
            event.stopPropagation();
            const rect = event.currentTarget.getBoundingClientRect();
            openMenu(rect.right, rect.bottom);
          }}
        >
          ⋮
        </button>
      </div>
      <div className="node-title">{node.label}</div>
      {nodeFailureReason ? <div className="node-failure-reason">{nodeFailureReason}</div> : null}
      {data.onlyRoot && node.id === "root-composer" ? (
        <div className="empty root-empty">
          <b>Start here — plan from this node</b>
          <span>Describe the workflow, then use Plan children to generate the graph.</span>
        </div>
      ) : null}
      {editable ? (
        <textarea
          className="node-card-prompt nodrag nowheel"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          aria-label={`Prompt for ${node.label || node.id}`}
        />
      ) : null}
      {composer && editable ? (
        <div className="node-card-footer">
          <button
            type="button"
            className="btn-primary-plan"
            disabled={isPlanning || prompt.trim().length === 0}
            onClick={planChildren}
          >
            <GitBranchPlus size={16} aria-hidden />
            {isPlanning ? "Planning..." : "Plan children"}
          </button>
        </div>
      ) : null}
      {node.loop ? <QualityLoopCardSummary loop={node.loop} /> : null}
      {composer ? (
        <>
          <div className="port-list">
            <div>
              <span className="port-heading">Inputs</span>
              {composer.inputs.map((port) => (
                <span className="port-pill" key={port.id}>
                  {port.label}: {port.artifactType}
                </span>
              ))}
            </div>
            <div>
              <span className="port-heading">Outputs</span>
              {composer.outputs.map((port) => (
                <span className="port-pill" key={port.id}>
                  {port.label}: {port.artifactType}
                </span>
              ))}
            </div>
          </div>
          <div className="budget-line">
            Budget used {composer.planBudget.usedDepth}/{composer.planBudget.maxDepth} depth ·{" "}
            {composer.planBudget.usedNodes}/{composer.planBudget.maxNodes} nodes · left{" "}
            {composer.planBudget.remainingDepth}/{composer.planBudget.remainingNodes}
            {composer.planBudget.exhausted ? (
              <span className="budget-stop">needs approval</span>
            ) : null}
          </div>
          {composer.pendingPlan ? (
            <div className="meta-row">
              Draft plan: {composer.pendingPlan.summary} ·{" "}
              {composer.pendingPlan.childNodeIds.length} nodes
            </div>
          ) : null}
          {planningError ? (
            <div className="meta-row warning">
              <AlertTriangle size={14} aria-hidden /> {planningError}
            </div>
          ) : null}
          {planningError?.includes("replan_requires_choice") ? (
            <div className="replan-gate" role="alert">
              <b>Protected replan</b>
              <span>Merge keeps protected edits and replans only replaceable drafts.</span>
              <div className="actions">
                <button className="danger" onClick={() => chooseReplan("replace")}>
                  Replace subtree
                </button>
                <button onClick={() => chooseReplan("merge")}>Merge</button>
                <button onClick={() => chooseReplan("cancel")}>Cancel</button>
              </div>
            </div>
          ) : null}
          <p className="node-context-hint">Right-click for actions</p>
          {composer.pendingPlan ? (
            <div className="meta-row">
              Plan ready — {composer.pendingPlan.childNodeIds.length} child nodes drafted. Review on
              canvas, then approve or run.
            </div>
          ) : null}
        </>
      ) : null}
      {composer && composer.outputs.length > 0 ? (
        composer.outputs.map((port, i) => (
          <Handle
            key={port.id}
            id={port.id}
            className="node-port node-port-output"
            type="source"
            position={Position.Right}
            style={{ top: `${((i + 1) / (composer.outputs.length + 1)) * 100}%` }}
          />
        ))
      ) : (
        <Handle
          className="node-port node-port-output"
          id="out"
          type="source"
          position={Position.Right}
        />
      )}
      <NodeContextMenu
        node={node}
        prompt={prompt}
        open={menuOpen}
        x={menuPos.x}
        y={menuPos.y}
        onClose={() => setMenuOpen(false)}
        setErrorMessage={data.setErrorMessage}
        refresh={data.refresh}
        setPlanningNodeId={data.setPlanningNodeId}
        setPlanningError={data.setPlanningError}
        onNavigateAdvancedSettings={data.onNavigateAdvancedSettings}
      />
    </div>
  );
}
