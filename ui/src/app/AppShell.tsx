import React, { Suspense, useState } from "react";
import type { OnConnect } from "@xyflow/react";
import { AdvancedLoadingFallback } from "../advanced/AdvancedLoadingFallback";

const LazyAdvancedHub = React.lazy(() =>
  import("../advanced/AdvancedHub").then((module) => ({ default: module.AdvancedHub })),
);
import { GraphCanvas } from "../canvas/GraphCanvas";
import { ExecutionNodeCard } from "../nodes/ExecutionNodeCard";
import { RunPanel } from "../run-panel/RunPanel";
import { FirstRunLauncher } from "./FirstRunLauncher";
import { TopBar } from "./TopBar";
import { useGraphCanvas } from "./hooks/useGraphCanvas";
import { useLauncherSessions } from "./hooks/useLauncherSessions";
import { useViewRouter } from "./hooks/useViewRouter";
import { useWorkflowSession } from "./hooks/useWorkflowSession";

const nodeTypes = { execution: ExecutionNodeCard };

export function AppShell() {
  const { snapshot, refresh } = useWorkflowSession();
  const {
    viewMode,
    setViewMode,
    advancedTab,
    showLauncher,
    dismissLauncher,
    navigateAdvancedSettings,
    launcherDismissed,
  } = useViewRouter(snapshot);
  const { savedSessions, refreshSavedSessions } = useLauncherSessions(showLauncher);

  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [planningNodeId, setPlanningNodeId] = useState<string | undefined>();
  const [planningError, setPlanningError] = useState<
    { nodeId: string; message: string } | undefined
  >();
  const [clarificationAnswer, setClarificationAnswer] = useState("");
  const [runVariant] = useState<"playbook" | "pipeline">("playbook");
  const [pipelineInput] = useState("");

  const selectedNode = selectedNodeId
    ? snapshot.graph.nodes.find((node) => node.id === selectedNodeId)
    : undefined;

  const graph = useGraphCanvas({
    snapshot,
    refresh,
    setErrorMessage,
    planningNodeId,
    setPlanningNodeId,
    planningError,
    setPlanningError,
    selectedNodeId,
    setSelectedNodeId,
    onNavigateAdvancedSettings: navigateAdvancedSettings,
    launcherDismissed,
  });

  return (
    <main
      className={`workflow-shell ${viewMode === "workflow" ? "workflow-mode" : "advanced-mode"}`}
    >
      {viewMode === "workflow" ? (
        <>
          <TopBar
            snapshot={snapshot}
            runVariant={runVariant}
            pipelineInput={pipelineInput}
            onAdvanced={() => setViewMode("advanced")}
            refresh={refresh}
            setErrorMessage={setErrorMessage}
          />
          {errorMessage ? <p className="error workflow-error">{errorMessage}</p> : null}
          {showLauncher ? (
            <FirstRunLauncher
              sessions={savedSessions}
              refreshSessions={refreshSavedSessions}
              refresh={refresh}
              setErrorMessage={setErrorMessage}
              initialPrompt={
                snapshot.graph.nodes.find((node) => node.id === "root-composer")?.prompt ?? ""
              }
              onContinue={dismissLauncher}
            />
          ) : null}
          <div
            className={`workflow-main ${showLauncher ? "workflow-main-dimmed" : ""}`}
            data-testid="workflow-main"
          >
            <section className="canvas">
              <GraphCanvas
                nodes={graph.nodes}
                edges={graph.edges}
                nodeTypes={nodeTypes}
                onNodesChange={graph.onNodesChange}
                onConnect={graph.onConnect as OnConnect}
                onNodeDragStart={graph.onNodeDragStart}
                onNodeDragStop={graph.onNodeDragStop}
                onViewportMoveEnd={graph.onViewportMoveEnd}
                onInit={graph.onInit}
                onNodeClick={(nodeId) => setSelectedNodeId(nodeId)}
                onPaneClick={() => setSelectedNodeId(undefined)}
              />
            </section>
            <RunPanel
              selectedNode={selectedNode}
              snapshot={snapshot}
              clarificationAnswer={clarificationAnswer}
              setClarificationAnswer={setClarificationAnswer}
              refresh={refresh}
              setErrorMessage={setErrorMessage}
              onSelectNode={setSelectedNodeId}
            />
          </div>
        </>
      ) : (
        <Suspense fallback={<AdvancedLoadingFallback label="Loading Advanced…" />}>
          <LazyAdvancedHub
            onBack={() => setViewMode("workflow")}
            initialTab={advancedTab}
            snapshot={snapshot}
            selectedNode={selectedNode}
            errorMessage={errorMessage}
            setErrorMessage={setErrorMessage}
            refresh={refresh}
            planningError={planningError}
          />
        </Suspense>
      )}
    </main>
  );
}
