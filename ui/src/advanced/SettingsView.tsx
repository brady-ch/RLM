import { useCallback, useEffect, useState } from "react";
import type { ExecutionNode, GraphWorkflowSummary, SessionSnapshot } from "../shared/types";
import { ThemeToggle } from "../shared/ThemeToggle";
import { GraphWorkflowPanel } from "./settings/GraphWorkflowPanel";
import { NodeInspector } from "./settings/NodeInspector";

export type SettingsViewProps = {
  snapshot: SessionSnapshot;
  selectedNode: ExecutionNode | undefined;
  planningError: { nodeId: string; message: string } | undefined;
  refresh: () => Promise<void>;
  setErrorMessage: (message: string | undefined) => void;
};

export function SettingsView({
  snapshot,
  selectedNode,
  planningError,
  refresh,
  setErrorMessage,
}: SettingsViewProps) {
  const [graphWorkflows, setGraphWorkflows] = useState<GraphWorkflowSummary[]>([]);

  const refreshGraphWorkflows = useCallback(async () => {
    const response = await fetch("/api/graph-workflows");
    if (!response.ok) {
      return;
    }
    const payload = (await response.json()) as { workflows: GraphWorkflowSummary[] };
    setGraphWorkflows(payload.workflows);
  }, []);

  useEffect(() => {
    void refreshGraphWorkflows();
  }, [refreshGraphWorkflows]);

  return (
    <div className="advanced-settings-view">
      <section className="settings-appearance" aria-label="Appearance">
        <h3>Appearance</h3>
        <ThemeToggle />
      </section>
      <details className="settings-collapsible">
        <summary>Graph workflows</summary>
        <GraphWorkflowPanel
          workflows={graphWorkflows}
          graphNodeCount={snapshot.graph.nodes.length}
          refresh={async () => {
            await refresh();
            await refreshGraphWorkflows();
          }}
          setErrorMessage={setErrorMessage}
        />
      </details>
      {selectedNode ? (
        <NodeInspector
          node={selectedNode}
          refresh={refresh}
          setErrorMessage={setErrorMessage}
          planningError={planningError}
        />
      ) : (
        <p className="empty">Select a node on the workflow canvas for overrides.</p>
      )}
    </div>
  );
}
