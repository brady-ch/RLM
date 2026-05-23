import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  applyNodeChanges,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type OnConnect,
  type ReactFlowInstance,
} from "@xyflow/react";
import type {
  FlowNodeData,
  GraphWorkflowSummary,
  MemorySnapshot,
  ModelLibraryEntry,
  ModelLibrarySnapshot,
  PluginDoctorResult,
  PluginListItem,
  PluginSnapshot,
  SavedSessionRecord,
  SavedSessionSummary,
  SessionSnapshot,
} from "../shared/types";
import { executionToFlowNode, graphToFlowEdges } from "../shared/graph-utils";
import { post, runAction } from "../shared/api";
import { AdvancedHub, type AdvancedTab } from "../advanced/AdvancedHub";
import { isPristineFirstRunGraph } from "../shared/session-utils";
import { FirstRunLauncher } from "./FirstRunLauncher";
import { TopBar } from "./TopBar";
import { GraphCanvas } from "../canvas/GraphCanvas";
import { RunPanel } from "../run-panel/RunPanel";
import { ExecutionNodeCard } from "../nodes/ExecutionNodeCard";

const nodeTypes = { execution: ExecutionNodeCard };

export function AppShell() {
  const [snapshot, setSnapshot] = useState<SessionSnapshot>({
    graph: { nodes: [], edges: [] },
    status: "planned",
    approvalMode: "full",
    autoApprovalPaused: false,
  });
  const [nodes, setNodes] = useState<Node<FlowNodeData>[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const draggingRef = useRef(false);
  const layoutFlushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingLayoutRef = useRef<Record<string, { x: number; y: number }>>({});
  const lastNodeDataSyncKey = useRef<string>("");
  const viewportFlushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rfInstanceRef = useRef<ReactFlowInstance<Node<FlowNodeData>, Edge> | null>(null);
  const prevGraphNodeIdsRef = useRef<string[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [planningNodeId, setPlanningNodeId] = useState<string | undefined>();
  const [planningError, setPlanningError] = useState<
    { nodeId: string; message: string } | undefined
  >();
  const [chatMessage, setChatMessage] = useState("");
  const [deleteStrategy, setDeleteStrategy] = useState<"delete_subtree" | "rewire_dependents">(
    "delete_subtree",
  );
  const [clarificationAnswer, setClarificationAnswer] = useState("");
  const [modelLibrary, setModelLibrary] = useState<ModelLibrarySnapshot | undefined>();
  const [modelSearch, setModelSearch] = useState("");
  const [modelSearchResults, setModelSearchResults] = useState<ModelLibraryEntry[]>([]);
  const [savedSessions, setSavedSessions] = useState<SavedSessionSummary[]>([]);
  const [savedSessionDetail, setSavedSessionDetail] = useState<SavedSessionRecord | undefined>();
  const [graphWorkflows, setGraphWorkflows] = useState<GraphWorkflowSummary[]>([]);
  const [runVariant, setRunVariant] = useState<"playbook" | "pipeline">("playbook");
  const [pipelineInput, setPipelineInput] = useState("");
  const [activeRunVariant, setActiveRunVariant] = useState<"playbook" | "pipeline" | undefined>();
  const [memory, setMemory] = useState<MemorySnapshot | undefined>();
  const [pluginSnapshot, setPluginSnapshot] = useState<PluginSnapshot>({ plugins: [] });
  const [pluginRestartRequired, setPluginRestartRequired] = useState(false);
  const selectedNode = selectedNodeId
    ? snapshot.graph.nodes.find((node) => node.id === selectedNodeId)
    : undefined;
  const readiness = snapshot.chat?.readiness ?? {
    state: "draft" as const,
    reason: "Draft graph: confirm graph and run to start execution.",
  };
  const runDisabled = readiness.state !== "ready_to_run";
  const graphHasPlannedNodes = snapshot.graph.nodes.length >= 2;

  const fitGraphToView = useCallback(() => {
    requestAnimationFrame(() => {
      void rfInstanceRef.current?.fitView({ padding: 0.2, duration: 300 });
    });
  }, []);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/session");
    if (!response.ok) {
      throw new Error(await response.text());
    }
    setSnapshot((await response.json()) as SessionSnapshot);
  }, []);

  const refreshModelLibrary = useCallback(async () => {
    const response = await fetch("/api/model-library");
    if (!response.ok) {
      return;
    }
    setModelLibrary((await response.json()) as ModelLibrarySnapshot);
  }, []);

  const refreshSavedSessions = useCallback(async () => {
    const response = await fetch("/api/saved-sessions");
    if (!response.ok) {
      return;
    }
    const payload = (await response.json()) as { sessions: SavedSessionSummary[] };
    setSavedSessions(payload.sessions);
  }, []);

  const refreshGraphWorkflows = useCallback(async () => {
    const response = await fetch("/api/graph-workflows");
    if (!response.ok) {
      return;
    }
    const payload = (await response.json()) as { workflows: GraphWorkflowSummary[] };
    setGraphWorkflows(payload.workflows);
  }, []);

  const refreshMemory = useCallback(async () => {
    const response = await fetch("/api/memory");
    if (!response.ok) {
      return;
    }
    setMemory((await response.json()) as MemorySnapshot);
  }, []);

  const refreshPlugins = useCallback(async () => {
    const [listResponse, doctorResponse] = await Promise.all([
      fetch("/api/plugins"),
      fetch("/api/plugins/doctor"),
    ]);
    if (!listResponse.ok) {
      return;
    }
    const listPayload = (await listResponse.json()) as { plugins: PluginListItem[] };
    const doctorPayload = doctorResponse.ok
      ? ((await doctorResponse.json()) as PluginDoctorResult)
      : undefined;
    setPluginSnapshot({ plugins: listPayload.plugins, doctor: doctorPayload });
  }, []);

  const [viewMode, setViewMode] = useState<"workflow" | "advanced">("workflow");
  const [advancedTab, setAdvancedTab] = useState<AdvancedTab>("settings");
  const [launcherDismissed, setLauncherDismissed] = useState(() => {
    try {
      return sessionStorage.getItem("rlm-workflow-entered") === "1";
    } catch {
      return false;
    }
  });
  const dismissLauncher = useCallback(() => {
    try {
      sessionStorage.setItem("rlm-workflow-entered", "1");
    } catch {
      // sessionStorage unavailable
    }
    setLauncherDismissed(true);
  }, []);
  const showLauncher =
    viewMode === "workflow" && isPristineFirstRunGraph(snapshot) && !launcherDismissed;

  useEffect(() => {
    if (showLauncher) {
      void refreshSavedSessions();
    }
  }, [showLauncher, refreshSavedSessions]);

  useEffect(() => {
    void refresh();
    const events = new EventSource("/api/events");
    events.addEventListener("snapshot", (event) => {
      try {
        setSnapshot(JSON.parse((event as MessageEvent).data) as SessionSnapshot);
      } catch {
        void refresh();
      }
    });
    events.addEventListener("execution", () => {
      void refresh();
    });
    return () => events.close();
  }, [refresh]);

  useEffect(() => {
    if (draggingRef.current) {
      return;
    }
    const nodeUiStateKey = JSON.stringify({
      nodes: snapshot.graph.nodes,
      edges: snapshot.graph.edges,
      planningNodeId,
      planningError,
      selectedNodeId,
      activeNodeId: snapshot.activeNodeId,
      runSummaryMessage: snapshot.runSummary?.message,
    });
    if (nodeUiStateKey === lastNodeDataSyncKey.current) {
      return;
    }
    lastNodeDataSyncKey.current = nodeUiStateKey;
    const onlyRoot =
      snapshot.graph.nodes.length === 1 && snapshot.graph.nodes[0]?.id === "root-composer";
    setNodes(
      snapshot.graph.nodes.map((node, index) =>
        executionToFlowNode(node, index, {
          refresh,
          setErrorMessage,
          planningNodeId,
          setPlanningNodeId,
          planningErrorNodeId: planningError?.nodeId,
          planningErrorMessage: planningError?.message,
          setPlanningError,
          onlyRoot,
          activeNodeId: snapshot.activeNodeId,
          runSummaryMessage: snapshot.runSummary?.message,
          isSelected: selectedNodeId === node.id,
          onNavigateAdvancedSettings: () => {
            setAdvancedTab("settings");
            setViewMode("advanced");
          },
        }),
      ),
    );
    setEdges(graphToFlowEdges(snapshot.graph.edges, snapshot.graph.nodes));
  }, [planningError, planningNodeId, refresh, selectedNodeId, snapshot]);

  useEffect(() => {
    if (!isPristineFirstRunGraph(snapshot)) {
      return;
    }
    if (!launcherDismissed) {
      return;
    }
    setSelectedNodeId("root-composer");
    rfInstanceRef.current?.setViewport({ x: 260, y: 120, zoom: 1 });
  }, [launcherDismissed, snapshot]);

  useEffect(() => {
    if (!isPristineFirstRunGraph(snapshot)) {
      setLauncherDismissed(true);
    }
  }, [snapshot]);

  useEffect(() => {
    const v = snapshot.graph.viewport;
    if (!v || !rfInstanceRef.current) {
      return;
    }
    rfInstanceRef.current.setViewport(v);
  }, [snapshot.graph.viewport]);

  useEffect(() => {
    const currentIds = snapshot.graph.nodes.map((node) => node.id);
    const prevIds = prevGraphNodeIdsRef.current;
    const addedIds = currentIds.filter((id) => !prevIds.includes(id));
    prevGraphNodeIdsRef.current = currentIds;

    if (addedIds.length === 0 || prevIds.length === 0) {
      return;
    }

    fitGraphToView();
  }, [fitGraphToView, snapshot.graph.nodes]);

  const flushLayout = useCallback(() => {
    if (layoutFlushTimer.current) {
      clearTimeout(layoutFlushTimer.current);
    }
    layoutFlushTimer.current = setTimeout(() => {
      layoutFlushTimer.current = null;
      const payload = { ...pendingLayoutRef.current };
      pendingLayoutRef.current = {};
      if (Object.keys(payload).length === 0) {
        return;
      }
      void runAction(
        setErrorMessage,
        async () => {
          await post("/api/graph/layout", { positions: payload });
        },
        refresh,
      );
    }, 150);
  }, [refresh]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds) => applyNodeChanges(changes, nds) as Node<FlowNodeData>[]);
      for (const ch of changes) {
        if (ch.type === "position" && ch.position && ch.id) {
          pendingLayoutRef.current[ch.id] = ch.position;
          flushLayout();
        }
      }
    },
    [flushLayout],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) {
        return;
      }
      void runAction(
        setErrorMessage,
        async () => {
          await post(`/api/nodes/${encodeURIComponent(connection.target)}/connect`, {
            parentId: connection.source,
            ...(connection.sourceHandle != null ? { sourceHandle: connection.sourceHandle } : {}),
            ...(connection.targetHandle != null ? { targetHandle: connection.targetHandle } : {}),
          });
        },
        refresh,
      );
    },
    [refresh],
  );

  const onViewportMoveEnd = useCallback(
    (_event: unknown, vp: { x: number; y: number; zoom: number }) => {
      if (viewportFlushTimer.current) {
        clearTimeout(viewportFlushTimer.current);
      }
      viewportFlushTimer.current = setTimeout(() => {
        viewportFlushTimer.current = null;
        void runAction(
          setErrorMessage,
          async () => {
            await post("/api/graph/viewport", { x: vp.x, y: vp.y, zoom: vp.zoom });
          },
          refresh,
        );
      }, 200);
    },
    [refresh],
  );

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
            activeRunVariant={activeRunVariant}
            setActiveRunVariant={setActiveRunVariant}
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
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodesChange={onNodesChange}
                onConnect={onConnect as OnConnect}
                onNodeDragStart={() => {
                  draggingRef.current = true;
                }}
                onNodeDragStop={() => {
                  draggingRef.current = false;
                }}
                onViewportMoveEnd={onViewportMoveEnd}
                onInit={(inst) => {
                  rfInstanceRef.current = inst;
                }}
                onNodeClick={(nodeId) => setSelectedNodeId(nodeId)}
                onPaneClick={() => setSelectedNodeId(undefined)}
              />
            </section>
            <RunPanel
              selectedNode={selectedNode}
              snapshot={snapshot}
              clarificationAnswer={clarificationAnswer}
              setClarificationAnswer={setClarificationAnswer}
              runDisabled={runDisabled}
              readinessReason={readiness.reason}
              refresh={refresh}
              setErrorMessage={setErrorMessage}
              onSelectNode={setSelectedNodeId}
              onFitGraph={fitGraphToView}
            />
          </div>
        </>
      ) : (
        <AdvancedHub
          onBack={() => setViewMode("workflow")}
          initialTab={advancedTab}
          snapshot={snapshot}
          selectedNode={selectedNode}
          errorMessage={errorMessage}
          setErrorMessage={setErrorMessage}
          refresh={refresh}
          modelLibrary={modelLibrary}
          modelSearch={modelSearch}
          setModelSearch={setModelSearch}
          modelSearchResults={modelSearchResults}
          setModelSearchResults={setModelSearchResults}
          refreshModelLibrary={refreshModelLibrary}
          pluginSnapshot={pluginSnapshot}
          pluginRestartRequired={pluginRestartRequired}
          setPluginRestartRequired={setPluginRestartRequired}
          refreshPlugins={refreshPlugins}
          savedSessions={savedSessions}
          savedSessionDetail={savedSessionDetail}
          setSavedSessionDetail={setSavedSessionDetail}
          refreshSavedSessions={refreshSavedSessions}
          memory={memory}
          refreshMemory={refreshMemory}
          graphWorkflows={graphWorkflows}
          refreshGraphWorkflows={refreshGraphWorkflows}
          runVariant={runVariant}
          setRunVariant={setRunVariant}
          pipelineInput={pipelineInput}
          setPipelineInput={setPipelineInput}
          chatMessage={chatMessage}
          setChatMessage={setChatMessage}
          deleteStrategy={deleteStrategy}
          setDeleteStrategy={setDeleteStrategy}
          graphHasPlannedNodes={graphHasPlannedNodes}
          planningError={planningError}
        />
      )}
    </main>
  );
}
