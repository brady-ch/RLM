import { useEffect } from "react";
import type { ExecutionNode, GraphWorkflowSummary, SessionSnapshot } from "../shared/types";
import { GraphWorkflowPanel, NodeInspector, RefineGraphPanel } from "../legacy/panels";

export type SettingsViewProps = {
  snapshot: SessionSnapshot;
  selectedNode: ExecutionNode | undefined;
  graphWorkflows: GraphWorkflowSummary[];
  runVariant: "playbook" | "pipeline";
  setRunVariant: (variant: "playbook" | "pipeline") => void;
  pipelineInput: string;
  setPipelineInput: (value: string) => void;
  chatMessage: string;
  setChatMessage: (value: string) => void;
  deleteStrategy: "delete_subtree" | "rewire_dependents";
  setDeleteStrategy: (strategy: "delete_subtree" | "rewire_dependents") => void;
  graphHasPlannedNodes: boolean;
  planningError: { nodeId: string; message: string } | undefined;
  refresh: () => Promise<void>;
  refreshGraphWorkflows: () => Promise<void>;
  setErrorMessage: (message: string | undefined) => void;
  onMount: () => void;
};

export function SettingsView({
  onMount,
  snapshot,
  selectedNode,
  graphWorkflows,
  runVariant,
  setRunVariant,
  pipelineInput,
  setPipelineInput,
  chatMessage,
  setChatMessage,
  deleteStrategy,
  setDeleteStrategy,
  graphHasPlannedNodes,
  planningError,
  refresh,
  refreshGraphWorkflows,
  setErrorMessage,
}: SettingsViewProps) {
  useEffect(() => {
    onMount();
  }, [onMount]);

  const pendingMutation = snapshot.chat?.pendingMutation;

  return (
    <div className="advanced-settings-view">
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
      <RefineGraphPanel
        collapsedByDefault={graphHasPlannedNodes}
        chatMessage={chatMessage}
        setChatMessage={setChatMessage}
        pendingMutation={pendingMutation}
        deleteStrategy={deleteStrategy}
        setDeleteStrategy={setDeleteStrategy}
        refresh={refresh}
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
