import type { ExecutionNode, SessionSnapshot } from "../shared/types";
import { uiRunStatusLabels } from "../shared/labels";

export type WorkflowOverviewProps = {
  snapshot: SessionSnapshot;
  onSelectNode: (nodeId: string | undefined) => void;
  onFitGraph: () => void;
};

function countByStatus(nodes: ExecutionNode[]): Partial<Record<ExecutionNode["status"], number>> {
  const counts: Partial<Record<ExecutionNode["status"], number>> = {};
  for (const node of nodes) {
    counts[node.status] = (counts[node.status] ?? 0) + 1;
  }
  return counts;
}

export function WorkflowOverview({ snapshot, onSelectNode, onFitGraph }: WorkflowOverviewProps) {
  const { nodes, edges } = snapshot.graph;
  const statusCounts = countByStatus(nodes);
  const runMessage = snapshot.runSummary?.message;

  return (
    <div className="workflow-overview" data-testid="workflow-overview">
      <header className="run-panel-header">
        <h2>Workflow overview</h2>
      </header>
      <div className="workflow-overview-summary">
        <p>
          <span className={`status ${snapshot.status}`}>
            {uiRunStatusLabels[snapshot.status] ?? snapshot.status}
          </span>
          {" · "}
          {nodes.length} node{nodes.length === 1 ? "" : "s"}, {edges.length} edge
          {edges.length === 1 ? "" : "s"}
        </p>
        {runMessage ? <p className="workflow-overview-run-message">{runMessage}</p> : null}
        {snapshot.resourceGuard?.runBlocked && snapshot.resourceGuard.runBlockedReason ? (
          <p className="workflow-overview-run-message warning">
            {snapshot.resourceGuard.runBlockedReason}
          </p>
        ) : null}
        {Object.keys(statusCounts).length > 0 ? (
          <ul className="workflow-status-counts" aria-label="Node status counts">
            {(Object.entries(statusCounts) as Array<[ExecutionNode["status"], number]>).map(
              ([status, count]) => (
                <li key={status}>
                  {uiRunStatusLabels[status] ?? status}: {count}
                </li>
              ),
            )}
          </ul>
        ) : null}
      </div>
      <div className="workflow-overview-actions">
        <button type="button" onClick={onFitGraph}>
          Fit graph to view
        </button>
      </div>
      {nodes.length > 0 ? (
        <div className="workflow-node-list">
          <label>Nodes</label>
          <ul>
            {nodes.map((node) => (
              <li key={node.id}>
                <button
                  type="button"
                  className="workflow-node-list-item"
                  onClick={() => onSelectNode(node.id)}
                >
                  <span className={`node-list-status ${node.status}`}>
                    {uiRunStatusLabels[node.status] ?? node.status}
                  </span>
                  <span className="node-list-label">{node.label}</span>
                  {node.id === snapshot.activeNodeId ? (
                    <span className="node-list-active">active</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="workflow-overview-hint">
        Use the minimap and canvas controls to pan and zoom. Select a node for approval actions and
        details.
      </p>
    </div>
  );
}
