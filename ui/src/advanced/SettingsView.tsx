import { useEffect } from "react";
import type { ExecutionNode, GraphWorkflowSummary, SessionSnapshot } from "../shared/types";
import { GraphWorkflowPanel } from "./settings/GraphWorkflowPanel";
import { NodeInspector } from "./settings/NodeInspector";

export type SettingsViewProps = {
  snapshot: SessionSnapshot;
  selectedNode: ExecutionNode | undefined;
  graphWorkflows: GraphWorkflowSummary[];
  runVariant: "playbook" | "pipeline";
  setRunVariant: (variant: "playbook" | "pipeline") => void;
  pipelineInput: string;
  setPipelineInput: (value: string) => void;
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
  planningError,
  refresh,
  refreshGraphWorkflows,
  setErrorMessage,
}: SettingsViewProps) {
  useEffect(() => {
    onMount();
  }, [onMount]);

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
