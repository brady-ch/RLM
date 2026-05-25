import { useCallback, useEffect, useState } from "react";
import type { ExecutionNode, GraphWorkflowSummary, SessionSnapshot } from "../shared/types";
import { ThemeToggle } from "../shared/ThemeToggle";
import { GraphWorkflowPanel } from "./settings/GraphWorkflowPanel";
import { NodeInspector } from "./settings/NodeInspector";

export type SettingsViewProps = {
  snapshot: SessionSnapshot;
  selectedNode: ExecutionNode | undefined;
  runVariant: "playbook" | "pipeline";
  setRunVariant: (variant: "playbook" | "pipeline") => void;
  pipelineInput: string;
  setPipelineInput: (value: string) => void;
  planningError: { nodeId: string; message: string } | undefined;
  refresh: () => Promise<void>;
  setErrorMessage: (message: string | undefined) => void;
};

export function SettingsView({
  snapshot,
  selectedNode,
  runVariant,
  setRunVariant,
  pipelineInput,
  setPipelineInput,
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
      <GraphWorkflowPanel
        workflows={graphWorkflows}
        graphNodeCount={snapshot.graph.nodes.length}
        runVariant={runVariant}
        setRunVariant={setRunVariant}
        pipelineInput={pipelineInput}
        setPipelineInput={setPipelineInput}
        refresh={async () => {
          await refresh();
          await refreshGraphWorkflows();
        }}
        setErrorMessage={setErrorMessage}
      />
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
