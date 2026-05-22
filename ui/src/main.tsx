import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  applyNodeChanges,
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type OnConnect,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  AlertTriangle,
  Check,
  Download,
  FolderOpen,
  GitBranchPlus,
  Puzzle,
  RefreshCw,
  Scissors,
  Search,
  Square,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import "./styles.css";

import type {
  ExecutionStatus,
  ExecutionNode,
  SessionSnapshot,
  FlowNodeData,
  ExecutionGraph,
  ModelLibrarySnapshot,
  ModelLibraryEntry,
  PluginSnapshot,
  SavedSessionSummary,
  SavedSessionRecord,
  GraphWorkflowSummary,
  MemorySnapshot,
  QualityLoopPhaseName,
  SamplingOptions,
} from "./shared/types";
import { uiRunStatusLabels } from "./shared/labels";
import { executionToFlowNode, graphToFlowEdges } from "./shared/graph-utils";
import {
  post,
  postJson,
  del,
  runAction,
  formatPlanningError,
  truncateFailureMessage,
  approvalModeLabel,
  phaseLabel,
  scoreFromSelection,
  formatPreferenceValue,
  deleteStrategyLabel,
} from "./shared/api";

export type { ExecutionNode, SessionSnapshot, FlowNodeData } from "./shared/types";
export { post, runAction } from "./shared/api";

const nodeTypes = {
  execution: ExecutionNodeCard,
};

function App() {
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
  const lastGraphSyncKey = useRef<string>("");
  const viewportFlushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rfInstanceRef = useRef<{
    setViewport: (v: { x: number; y: number; zoom: number }) => void;
  } | null>(null);
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
  const selectedNode =
    snapshot.graph.nodes.find((node) => node.id === selectedNodeId) ?? snapshot.graph.nodes[0];
  const readiness = snapshot.chat?.readiness ?? {
    state: "draft" as const,
    reason: "Draft graph: confirm graph and run to start execution.",
  };
  const runDisabled = readiness.state !== "ready_to_run";
  const pendingMutation = snapshot.chat?.pendingMutation;
  const pendingClarification = snapshot.chat?.pendingClarification;
  const clarificationHistory = snapshot.chat?.clarificationHistory ?? [];
  const graphHasPlannedNodes = snapshot.graph.nodes.length >= 2;

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

  useEffect(() => {
    void refresh();
    void refreshModelLibrary();
    void refreshSavedSessions();
    void refreshGraphWorkflows();
    void refreshMemory();
    void refreshPlugins();
    const events = new EventSource("/api/events");
    events.addEventListener("snapshot", (event) => {
      setSnapshot(JSON.parse((event as MessageEvent).data) as SessionSnapshot);
    });
    events.addEventListener("execution", () => {
      void refresh();
      void refreshModelLibrary();
      void refreshSavedSessions();
      void refreshMemory();
    });
    return () => events.close();
  }, [
    refresh,
    refreshMemory,
    refreshModelLibrary,
    refreshPlugins,
    refreshSavedSessions,
    refreshGraphWorkflows,
  ]);

  useEffect(() => {
    if (draggingRef.current) {
      return;
    }
    const key = JSON.stringify({ nodes: snapshot.graph.nodes, edges: snapshot.graph.edges });
    if (key === lastGraphSyncKey.current) {
      return;
    }
    lastGraphSyncKey.current = key;
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
        }),
      ),
    );
    setEdges(graphToFlowEdges(snapshot.graph.edges));
  }, [planningError, planningNodeId, refresh, snapshot]);

  useEffect(() => {
    if (snapshot.graph.nodes.length === 1 && snapshot.graph.nodes[0]?.id === "root-composer") {
      setSelectedNodeId("root-composer");
      rfInstanceRef.current?.setViewport({ x: 260, y: 120, zoom: 1 });
    }
  }, [snapshot.graph.nodes]);

  useEffect(() => {
    const v = snapshot.graph.viewport;
    if (!v || !rfInstanceRef.current) {
      return;
    }
    rfInstanceRef.current.setViewport(v);
  }, [snapshot.graph.viewport]);

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
    <main className="shell">
      <section className="canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onConnect={onConnect as OnConnect}
          nodesConnectable
          nodesDraggable
          onNodeDragStart={() => {
            draggingRef.current = true;
          }}
          onNodeDragStop={() => {
            draggingRef.current = false;
          }}
          onMoveEnd={onViewportMoveEnd}
          onInit={(inst) => {
            rfInstanceRef.current = inst;
          }}
          onNodeClick={(_, node) => setSelectedNodeId(node.id)}
        >
          <Background gap={20} color="#d8ded9" />
          <MiniMap pannable zoomable />
          <Controls />
        </ReactFlow>
      </section>
      <aside className="inspector">
        <header>
          <div className="run-status-block" aria-live="polite">
            <span className={`status ${snapshot.status}`} title={snapshot.runSummary?.message}>
              {uiRunStatusLabels[snapshot.status] ?? snapshot.status}
            </span>
            {activeRunVariant || snapshot.status === "running" ? (
              <span className="meta-pill run-variant-pill">
                Running {activeRunVariant ?? runVariant}
              </span>
            ) : null}
            {snapshot.activeNodeId
              ? (() => {
                  const activeNode = snapshot.graph.nodes.find(
                    (node) => node.id === snapshot.activeNodeId,
                  );
                  if (!activeNode) {
                    return null;
                  }
                  return (
                    <span className="run-active-node">
                      Running: {activeNode.label} ({activeNode.expertAgentId ?? "default"},{" "}
                      {activeNode.expertRuntime ?? "single-pass"})
                    </span>
                  );
                })()
              : null}
            {snapshot.status === "failed" && snapshot.runSummary?.message ? (
              <span className="run-failure-hint">Run stopped: {snapshot.runSummary.message}</span>
            ) : null}
          </div>
          <span className="meta-pill">{approvalModeLabel(snapshot.approvalMode)}</span>
          <button
            className="icon"
            aria-label="Run workflow"
            onClick={() =>
              runAction(
                setErrorMessage,
                async () => {
                  setActiveRunVariant(runVariant);
                  return post("/api/chat/confirm-run", {
                    variant: runVariant,
                    input: runVariant === "pipeline" ? pipelineInput : undefined,
                  });
                },
                refresh,
              )
            }
          >
            Run workflow
          </button>
          <button
            className="icon"
            title="Pause future auto-approvals"
            aria-label="Pause future auto-approvals"
            onClick={() =>
              runAction(
                setErrorMessage,
                () => post("/api/pause-future-auto-approvals", {}),
                refresh,
              )
            }
          >
            Pause future auto
          </button>
          <button
            className="icon danger"
            title="Stop run"
            aria-label="Stop run"
            onClick={() =>
              runAction(
                setErrorMessage,
                () => post("/api/stop", { reason: "stopped from UI" }),
                refresh,
              )
            }
          >
            <Square size={16} aria-hidden />
          </button>
        </header>
        {errorMessage ? <p className="error">{errorMessage}</p> : null}
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
        <SavedSessionPanel
          sessions={savedSessions}
          detail={savedSessionDetail}
          setDetail={setSavedSessionDetail}
          refresh={async () => {
            await refresh();
            await refreshSavedSessions();
          }}
          setErrorMessage={setErrorMessage}
        />
        <MemoryPanel memory={memory} refresh={refreshMemory} setErrorMessage={setErrorMessage} />
        <ModelLibraryPanel
          library={modelLibrary}
          search={modelSearch}
          setSearch={setModelSearch}
          searchResults={modelSearchResults}
          setSearchResults={setModelSearchResults}
          refresh={refreshModelLibrary}
          setErrorMessage={setErrorMessage}
        />
        <PluginPanel
          snapshot={pluginSnapshot}
          restartRequired={pluginRestartRequired}
          setRestartRequired={setPluginRestartRequired}
          refresh={refreshPlugins}
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
          <p className="empty">Waiting for execution graph.</p>
        )}
        <div className="node-inspector">
          <div>
            <label>Run control</label>
            <button disabled={runDisabled}>Run disabled until confirmed</button>
            {runDisabled ? (
              <div className="meta-row">{readiness.reason}</div>
            ) : (
              <div className="meta-row">Ready to run.</div>
            )}
          </div>
          <div>
            <label>Clarification timeline</label>
            {pendingClarification ? (
              <div className="meta-row">
                <div>
                  <b>Pending:</b> {pendingClarification.promptText}
                </div>
                <div className="meta-row">
                  node={pendingClarification.nodeId} asked={pendingClarification.askedAt}
                </div>
                <textarea
                  value={clarificationAnswer}
                  onChange={(event) => setClarificationAnswer(event.target.value)}
                  placeholder="Type clarification answer"
                />
                <div className="actions">
                  <button
                    disabled={clarificationAnswer.trim().length === 0}
                    onClick={() =>
                      runAction(
                        setErrorMessage,
                        () =>
                          post("/api/clarifications/answer", {
                            questionId: pendingClarification.questionId,
                            userAnswer: clarificationAnswer,
                          }),
                        async () => {
                          setClarificationAnswer("");
                          await refresh();
                        },
                      )
                    }
                  >
                    Submit answer
                  </button>
                  <button
                    className="danger"
                    onClick={() =>
                      runAction(
                        setErrorMessage,
                        () =>
                          post("/api/clarifications/abort", {
                            questionId: pendingClarification.questionId,
                          }),
                        refresh,
                      )
                    }
                  >
                    Abort run
                  </button>
                </div>
              </div>
            ) : (
              <div className="meta-row">No pending clarification.</div>
            )}
            <div className="meta-row">
              {clarificationHistory.length === 0
                ? "No clarification history yet."
                : clarificationHistory.map((record) => (
                    <div key={record.resume_event_id}>
                      Q[{record.question_id}] {record.prompt_text} {"->"} A: {record.user_answer}
                    </div>
                  ))}
            </div>
          </div>
        </div>
      </aside>
    </main>
  );
}

function ExecutionNodeCard({ data }: { data: FlowNodeData }) {
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
  useEffect(() => {
    setPrompt(node.prompt ?? "");
  }, [node.id, node.prompt]);

  const planFromCard = () => {
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
      className={`node-card ${node.status} ${node.id === "root-composer" ? "root-composer-focus" : ""} ${isPlanning ? "planning-in-progress" : ""} ${isActive ? "active-execution" : ""} ${blockedByAncestor ? "blocked-by-ancestor" : ""}`}
      aria-busy={node.status === "running" || isPlanning ? "true" : undefined}
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
      </div>
      <div className="node-title">{node.label}</div>
      {nodeFailureReason ? <div className="node-failure-reason">{nodeFailureReason}</div> : null}
      {data.onlyRoot && node.id === "root-composer" ? (
        <div className="empty root-empty">
          <b>Start here — plan from this node</b>
          <span>
            Describe your workflow above, then click Plan children. Graph submit is the default
            authoring path.
          </span>
        </div>
      ) : null}
      {editable ? (
        <textarea
          className="node-card-prompt"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          aria-label={`Prompt for ${node.label || node.id}`}
        />
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
          <div className="node-card-footer">
            <button
              className="btn-primary-plan"
              disabled={!editable || prompt.trim().length === 0 || isPlanning}
              aria-label={`Plan children for ${node.label || node.id}`}
              onClick={planFromCard}
            >
              <GitBranchPlus size={16} aria-hidden />
              {isPlanning ? "Planning children..." : "Plan children"}
            </button>
          </div>
          {composer.pendingPlan ? (
            <div className="meta-row">
              Plan ready — {composer.pendingPlan.childNodeIds.length} child nodes drafted. Review on
              canvas, then approve or run.
            </div>
          ) : null}
        </>
      ) : null}
      <div className="node-models">
        <div>P: {node.plannedModel ?? "resolved-at-runtime"}</div>
        <div>E: {node.effectiveModel ?? "pending"}</div>
        <div>Expert: {node.expertAgentId ?? "default"}</div>
        <div>Runtime: {node.expertRuntime ?? "single-pass"}</div>
        {node.expertAssignmentMode === "custom" ? <div className="badge">custom</div> : null}
        <div>Mode: {node.approvalMode ?? "full"}</div>
        <div>Approval: {node.approvalSource ?? "none"}</div>
        {node.spawnedAfterInitialApproval ? <div className="badge">spawned branch</div> : null}
      </div>
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
    </div>
  );
}

function RefineGraphPanel({
  collapsedByDefault,
  chatMessage,
  setChatMessage,
  pendingMutation,
  deleteStrategy,
  setDeleteStrategy,
  refresh,
  setErrorMessage,
}: {
  collapsedByDefault: boolean;
  chatMessage: string;
  setChatMessage: (value: string) => void;
  pendingMutation: NonNullable<SessionSnapshot["chat"]>["pendingMutation"];
  deleteStrategy: "delete_subtree" | "rewire_dependents";
  setDeleteStrategy: (value: "delete_subtree" | "rewire_dependents") => void;
  refresh: () => Promise<void>;
  setErrorMessage: (message: string | undefined) => void;
}) {
  return (
    <details className="session-panel chat-refine-panel" open={!collapsedByDefault}>
      <summary>Refine graph (optional secondary)</summary>
      <div className="meta-row">
        Graph node submit is the default authoring path. Use chat only to preview edits after
        planning.
      </div>
      <textarea
        value={chatMessage}
        onChange={(event) => setChatMessage(event.target.value)}
        placeholder="edit task-1: refine this prompt"
        aria-label="Optional graph refinement chat"
      />
      <div className="actions">
        <button
          disabled={chatMessage.trim().length === 0}
          onClick={() =>
            runAction(
              setErrorMessage,
              () => post("/api/chat/message", { message: chatMessage }),
              refresh,
            )
          }
        >
          Preview mutation
        </button>
        <button
          onClick={() => runAction(setErrorMessage, () => post("/api/chat/cancel", {}), refresh)}
        >
          Clear preview
        </button>
      </div>
      {pendingMutation ? (
        <div className="meta-row">
          Pending: {pendingMutation.summary}
          {pendingMutation.requiresDeleteChoice && pendingMutation.pendingDeleteChoice ? (
            <div className="actions">
              <select
                value={deleteStrategy}
                onChange={(event) =>
                  setDeleteStrategy(event.target.value as "delete_subtree" | "rewire_dependents")
                }
              >
                {pendingMutation.pendingDeleteChoice.options.map((option) => (
                  <option key={option} value={option}>
                    {deleteStrategyLabel(option)}
                  </option>
                ))}
              </select>
              <button
                onClick={() =>
                  runAction(
                    setErrorMessage,
                    () =>
                      post("/api/chat/apply", { proposalId: pendingMutation.id, deleteStrategy }),
                    refresh,
                  )
                }
              >
                Apply preview
              </button>
            </div>
          ) : (
            <div className="actions">
              <button
                onClick={() =>
                  runAction(
                    setErrorMessage,
                    () => post("/api/chat/apply", { proposalId: pendingMutation.id }),
                    refresh,
                  )
                }
              >
                Apply preview
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="meta-row">No pending mutation preview.</div>
      )}
    </details>
  );
}

function GraphWorkflowPanel({
  workflows,
  graphNodeCount,
  runVariant,
  setRunVariant,
  pipelineInput,
  setPipelineInput,
  refresh,
  setErrorMessage,
}: {
  workflows: GraphWorkflowSummary[];
  graphNodeCount: number;
  runVariant: "playbook" | "pipeline";
  setRunVariant: (variant: "playbook" | "pipeline") => void;
  pipelineInput: string;
  setPipelineInput: (value: string) => void;
  refresh: () => Promise<void>;
  setErrorMessage: (message: string | undefined) => void;
}) {
  const [saveOpen, setSaveOpen] = useState(false);
  const [workflowName, setWorkflowName] = useState("");
  const [description, setDescription] = useState("");
  const [saveVariant, setSaveVariant] = useState<GraphWorkflowSaveVariant>("both");
  const [saveMessage, setSaveMessage] = useState<string | undefined>();

  return (
    <section className="session-panel graph-workflow-panel">
      <div className="panel-heading">
        <div>
          <label>Graph workflows</label>
          <div className="meta-row">Save, import, and run frozen graph sidecars.</div>
        </div>
        <div className="actions">
          <button disabled={graphNodeCount === 0} onClick={() => setSaveOpen(true)}>
            <Download size={16} aria-hidden />
            Save as workflow
          </button>
          <button onClick={() => runAction(setErrorMessage, async () => refresh(), refresh)}>
            <RefreshCw size={16} aria-hidden />
            Refresh
          </button>
        </div>
      </div>
      <div className="run-variant-controls">
        <label htmlFor="run-variant">Run as</label>
        <select
          id="run-variant"
          value={runVariant}
          onChange={(event) => setRunVariant(event.target.value as "playbook" | "pipeline")}
        >
          <option value="playbook">Playbook</option>
          <option value="pipeline">Pipeline</option>
        </select>
        {runVariant === "pipeline" ? (
          <input
            aria-label="Pipeline task input"
            placeholder="Task input for {{input}}"
            value={pipelineInput}
            onChange={(event) => setPipelineInput(event.target.value)}
          />
        ) : null}
      </div>
      {saveMessage ? <div className="meta-row">{saveMessage}</div> : null}
      {workflows.length === 0 ? (
        <div className="empty session-empty">
          <b>No graph workflows</b>
          <span>Save the current graph as a workflow sidecar under .rlm/workflows/.</span>
        </div>
      ) : (
        <div className="session-list">
          <div className="meta-row">Graph workflows</div>
          {workflows.map((item) => (
            <div className="session-row complete" key={item.id}>
              <div className="session-row-main">
                <b>{item.id}</b>
                <span>
                  {item.variants.join(", ")} · {new Date(item.updatedAt).toLocaleString()}
                </span>
              </div>
              <button
                className="icon"
                title="Import workflow"
                aria-label={`Import ${item.id}`}
                onClick={() => {
                  if (
                    !window.confirm(`Import workflow "${item.id}"? Current graph will be replaced.`)
                  ) {
                    return;
                  }
                  void runAction(
                    setErrorMessage,
                    async () => {
                      await post("/api/graph-workflows/import", { workflowId: item.id });
                      setSaveMessage(
                        `Workflow imported: ${item.id} — Edit and re-export from the graph editor.`,
                      );
                    },
                    refresh,
                  );
                }}
              >
                <Upload size={16} aria-hidden />
                Import workflow
              </button>
            </div>
          ))}
        </div>
      )}
      {saveOpen ? (
        <div className="modal-overlay" role="presentation" onClick={() => setSaveOpen(false)}>
          <div
            className="modal-card"
            role="dialog"
            aria-labelledby="save-graph-workflow-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="panel-heading">
              <h2 id="save-graph-workflow-title">Save graph workflow</h2>
              <button
                className="icon"
                aria-label="Close save dialog"
                onClick={() => setSaveOpen(false)}
              >
                <X size={16} aria-hidden />
              </button>
            </div>
            <label htmlFor="workflow-name">Workflow name</label>
            <input
              id="workflow-name"
              value={workflowName}
              onChange={(event) => setWorkflowName(event.target.value)}
            />
            <label htmlFor="workflow-description">Description (optional)</label>
            <textarea
              id="workflow-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
            <fieldset className="variant-fieldset">
              <legend>Save as:</legend>
              <label>
                <input
                  type="radio"
                  name="save-variant"
                  checked={saveVariant === "playbook"}
                  onChange={() => setSaveVariant("playbook")}
                />{" "}
                Playbook
              </label>
              <div className="meta-row">Replay with literal prompts — no substitution.</div>
              <label>
                <input
                  type="radio"
                  name="save-variant"
                  checked={saveVariant === "pipeline"}
                  onChange={() => setSaveVariant("pipeline")}
                />{" "}
                Pipeline
              </label>
              <div className="meta-row">
                Root prompt uses `{"{{input}}"}` for new tasks each run.
              </div>
              <label>
                <input
                  type="radio"
                  name="save-variant"
                  checked={saveVariant === "both"}
                  onChange={() => setSaveVariant("both")}
                />{" "}
                Both
              </label>
            </fieldset>
            <div className="actions">
              <button
                disabled={workflowName.trim().length === 0}
                onClick={() =>
                  runAction(
                    setErrorMessage,
                    async () => {
                      await post("/api/graph-workflows/export", {
                        workflowId: workflowName.trim(),
                        description: description.trim() || undefined,
                        variant: saveVariant,
                      });
                      setSaveMessage(`Workflow saved: ${workflowName.trim()}`);
                      setSaveOpen(false);
                    },
                    refresh,
                  )
                }
              >
                Save
              </button>
              <button onClick={() => setSaveOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function SavedSessionPanel({
  sessions,
  detail,
  setDetail,
  refresh,
  setErrorMessage,
}: {
  sessions: SavedSessionSummary[];
  detail: SavedSessionRecord | undefined;
  setDetail: (detail: SavedSessionRecord | undefined) => void;
  refresh: () => Promise<void>;
  setErrorMessage: (message: string | undefined) => void;
}) {
  return (
    <section className="session-panel">
      <div className="panel-heading">
        <div>
          <label>Saved sessions</label>
          <div className="meta-row">
            Save or reopen graph, approvals, artifacts, and memory contract.
          </div>
        </div>
        <div className="actions">
          <button
            onClick={() =>
              runAction(
                setErrorMessage,
                () =>
                  post("/api/saved-sessions/save", {
                    name: `Session ${new Date().toLocaleString()}`,
                  }),
                refresh,
              )
            }
          >
            <Download size={16} aria-hidden />
            Save session
          </button>
          <button onClick={() => runAction(setErrorMessage, async () => refresh(), refresh)}>
            <RefreshCw size={16} aria-hidden />
            Refresh
          </button>
        </div>
      </div>
      {sessions.length === 0 ? (
        <div className="empty session-empty">
          <b>No saved sessions</b>
          <span>
            Save this workflow to reopen the graph, approvals, artifacts, and memory contract later.
          </span>
        </div>
      ) : (
        <div className="session-list">
          {sessions.slice(0, 5).map((item) => (
            <div className={`session-row ${item.status}`} key={item.id}>
              <div className="session-row-main">
                <b>{item.name}</b>
                <span>
                  {item.id} · {new Date(item.updatedAt).toLocaleString()}
                </span>
              </div>
              <span className={`restore-pill ${item.status}`}>{item.status}</span>
              <button
                className="icon"
                title="Inspect saved session"
                aria-label={`Inspect ${item.name}`}
                onClick={() =>
                  runAction(setErrorMessage, async () => {
                    const response = await fetch(
                      `/api/saved-sessions/${encodeURIComponent(item.id)}`,
                    );
                    if (!response.ok) {
                      throw new Error(await response.text());
                    }
                    setDetail((await response.json()) as SavedSessionRecord);
                  })
                }
              >
                {item.status === "complete" ? (
                  <Check size={16} aria-hidden />
                ) : (
                  <AlertTriangle size={16} aria-hidden />
                )}
              </button>
              <button
                className="icon"
                title="Open saved session"
                aria-label={`Open ${item.name}`}
                onClick={() =>
                  runAction(
                    setErrorMessage,
                    () => post(`/api/saved-sessions/${encodeURIComponent(item.id)}/open`, {}),
                    refresh,
                  )
                }
              >
                <FolderOpen size={16} aria-hidden />
              </button>
            </div>
          ))}
        </div>
      )}
      {detail ? (
        <div className={`restore-detail ${detail.verification.status}`}>
          <div className="panel-heading">
            <div>
              <b>
                {detail.verification.status === "complete"
                  ? "Session restored"
                  : "Session restored with missing data"}
              </b>
              <div className="meta-row">
                {detail.name} · unsafeToContinue={String(detail.verification.unsafeToContinue)}
              </div>
            </div>
            <button
              className="icon"
              aria-label="Close saved session detail"
              onClick={() => setDetail(undefined)}
            >
              <X size={16} aria-hidden />
            </button>
          </div>
          <div className="restore-grid">
            {detail.verification.sections.map((section) => (
              <React.Fragment key={section.name}>
                <span>{section.name}</span>
                <b className={section.status}>{section.status}</b>
                <em>{section.reason ?? `v${section.version ?? "?"}`}</em>
              </React.Fragment>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function MemoryPanel({
  memory,
  refresh,
  setErrorMessage,
}: {
  memory?: MemorySnapshot;
  refresh: () => Promise<void>;
  setErrorMessage: (message: string | undefined) => void;
}) {
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const preferences = memory?.scopes.find((scope) => scope.scopeId === "project-preferences");
  const preferenceEntries = Object.entries(preferences?.content ?? {});
  const rejected = memory?.audit.filter((record) => !record.accepted) ?? [];
  const degradedPackets =
    memory?.packets.filter((packet) => packet.degraded || packet.truncated) ?? [];

  return (
    <section className="memory-panel">
      <div className="panel-heading">
        <div>
          <label>Memory</label>
          <div className="meta-row">
            {memory
              ? `${memory.scopes.length} scopes · ${memory.episodic.length} episodes · ${memory.packets.length} packets`
              : "Memory inspection unavailable."}
          </div>
        </div>
        <button
          className="icon"
          title="Refresh memory"
          onClick={() => runAction(setErrorMessage, refresh, refresh)}
        >
          <RefreshCw size={16} aria-hidden />
        </button>
      </div>
      <div className="preference-editor">
        <input
          value={key}
          onChange={(event) => setKey(event.target.value)}
          placeholder="Preference key"
        />
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Preference value"
        />
        <button
          disabled={!key.trim() || !value.trim()}
          onClick={() =>
            runAction(
              setErrorMessage,
              async () => {
                await post("/api/memory/preferences", { key, value, lifetime: "project" });
                setKey("");
                setValue("");
              },
              refresh,
            )
          }
        >
          Save
        </button>
      </div>
      {preferenceEntries.length === 0 ? (
        <div className="meta-row">No project preferences saved.</div>
      ) : (
        preferenceEntries.map(([prefKey, prefValue]) => (
          <div className="memory-row" key={prefKey}>
            <div>
              <b>{prefKey}</b>
              <span>{formatPreferenceValue(prefValue)}</span>
            </div>
            <button
              className="icon danger"
              aria-label={`Delete preference ${prefKey}`}
              onClick={() =>
                runAction(
                  setErrorMessage,
                  () => del(`/api/memory/preferences/${encodeURIComponent(prefKey)}`),
                  refresh,
                )
              }
            >
              <Trash2 size={16} aria-hidden />
            </button>
          </div>
        ))
      )}
      <div className="memory-grid">
        {(memory?.scopes ?? []).slice(0, 6).map((scope) => (
          <div className="memory-chip" key={`${scope.lifetime}:${scope.scopeId}`}>
            <b>{scope.scopeId}</b>
            <span>
              {scope.lifetime} · v{scope.version}
            </span>
          </div>
        ))}
      </div>
      {(memory?.episodic ?? []).slice(-4).map((entry) => (
        <div className="meta-row" key={entry.id}>
          {entry.type}
          {entry.nodeId ? ` ${entry.nodeId}` : ""}: {entry.summary}
        </div>
      ))}
      {degradedPackets.length > 0 ? (
        <div className="meta-row warning">
          {degradedPackets.length} degraded or truncated packet
          {degradedPackets.length === 1 ? "" : "s"} recorded.
        </div>
      ) : null}
      {(memory?.packets ?? [])
        .flatMap((packet) => packet.retrievalHits ?? [])
        .slice(0, 3)
        .map((hit, index) => (
          <div className="meta-row" key={`${hit.scopeId}-${index}`}>
            {hit.source}:{hit.scopeId} score {hit.score.toFixed(3)} - {hit.snippet}
          </div>
        ))}
      {rejected.length > 0 ? (
        <div className="meta-row warning">
          {rejected.length} rejected memory write{rejected.length === 1 ? "" : "s"} in audit.
        </div>
      ) : null}
    </section>
  );
}

function ModelLibraryPanel({
  library,
  search,
  setSearch,
  searchResults,
  setSearchResults,
  refresh,
  setErrorMessage,
}: {
  library?: ModelLibrarySnapshot;
  search: string;
  setSearch: (value: string) => void;
  searchResults: ModelLibraryEntry[];
  setSearchResults: (value: ModelLibraryEntry[]) => void;
  refresh: () => Promise<void>;
  setErrorMessage: (message: string | undefined) => void;
}) {
  const tierEntries = Object.entries(library?.tiers ?? {});
  return (
    <div className="model-library-panel">
      <div className="panel-heading">
        <label>Model Library</label>
        <button
          className="icon"
          title="Refresh models"
          onClick={() => runAction(setErrorMessage, refresh, refresh)}
        >
          <RefreshCw size={16} />
        </button>
      </div>
      <div className="model-search">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search Hugging Face"
        />
        <button
          disabled={search.trim().length === 0}
          onClick={() =>
            runAction(
              setErrorMessage,
              async () => {
                const response = await fetch(
                  `/api/model-library/search?q=${encodeURIComponent(search)}`,
                );
                if (!response.ok) {
                  throw new Error(await response.text());
                }
                const payload = (await response.json()) as { results: ModelLibraryEntry[] };
                setSearchResults(payload.results);
              },
              refresh,
            )
          }
        >
          <Search size={16} /> Search
        </button>
      </div>
      <div className="tier-grid">
        {tierEntries.map(([tier, model]) => (
          <div className="meta-row" key={tier}>
            {tier}: {model}
          </div>
        ))}
      </div>
      <div className="model-list">
        {(library?.curated ?? []).map((entry) => (
          <ModelLibraryRow
            key={entry.id}
            entry={entry}
            library={library}
            refresh={refresh}
            setErrorMessage={setErrorMessage}
          />
        ))}
      </div>
      {searchResults.length > 0 ? (
        <div className="model-list">
          <label>Hugging Face Results</label>
          {searchResults.map((entry) => (
            <ModelLibraryRow
              key={entry.id}
              entry={entry}
              library={library}
              refresh={refresh}
              setErrorMessage={setErrorMessage}
            />
          ))}
        </div>
      ) : null}
      {(library?.jobs ?? []).map((job) => (
        <div className={`meta-row model-job ${job.status}`} key={job.id}>
          {job.model}: {job.status} {Math.round(job.progress * 100)}% - {job.message}
        </div>
      ))}
    </div>
  );
}

function ModelLibraryRow({
  entry,
  library,
  refresh,
  setErrorMessage,
}: {
  entry: ModelLibraryEntry;
  library?: ModelLibrarySnapshot;
  refresh: () => Promise<void>;
  setErrorMessage: (message: string | undefined) => void;
}) {
  const selectableModel = entry.ollamaModel ?? entry.id;
  return (
    <div className={`model-row ${entry.status}`}>
      <div>
        <b>{entry.label}</b>
        <p>{entry.description}</p>
        <div className="tag-row">
          {entry.tags.slice(0, 4).map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
        {entry.reason ? <div className="meta-row warning">{entry.reason}</div> : null}
      </div>
      <div className="actions model-actions">
        <button
          disabled={
            entry.source !== "curated" ||
            entry.status === "installed" ||
            entry.status === "installing"
          }
          onClick={() =>
            runAction(
              setErrorMessage,
              () => post("/api/model-library/install", { model: selectableModel }),
              refresh,
            )
          }
        >
          <Download size={16} /> Install
        </button>
        <select
          disabled={entry.status !== "installed" || !library}
          onChange={(event) => {
            if (!event.target.value) {
              return;
            }
            void runAction(
              setErrorMessage,
              () =>
                post("/api/model-library/select-tier", {
                  tier: event.target.value,
                  model: selectableModel,
                }),
              refresh,
            );
            event.target.value = "";
          }}
          defaultValue=""
        >
          <option value="">Assign tier</option>
          {Object.keys(library?.tiers ?? {}).map((tier) => (
            <option key={tier} value={tier}>
              {tier}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function formatPluginLine(plugin: PluginListItem): string {
  const tools = plugin.tools.join(", ") || "(none)";
  return `${plugin.id} [${plugin.category}] source=${plugin.source} enabled=${plugin.enabled} tools=${tools}`;
}

function formatDoctorIssue(issue: PluginDoctorIssue): string {
  const prefix = issue.severity === "error" ? "ERROR" : "WARN";
  return `${prefix} ${issue.code}: ${issue.message}`;
}

function PluginPanel({
  snapshot,
  restartRequired,
  setRestartRequired,
  refresh,
  setErrorMessage,
}: {
  snapshot: PluginSnapshot;
  restartRequired: boolean;
  setRestartRequired: (value: boolean) => void;
  refresh: () => Promise<void>;
  setErrorMessage: (message: string | undefined) => void;
}) {
  const [installSource, setInstallSource] = useState("");
  const [pendingInstall, setPendingInstall] = useState<PluginInstallPreview | undefined>();

  const markRestartIfNeeded = (result: { requiresRestart?: boolean }) => {
    if (result.requiresRestart) {
      setRestartRequired(true);
    }
  };

  const runInstall = async (source: string, confirm = false) => {
    const payload = (await postJson("/api/plugins/install", {
      path: source,
      ...(confirm ? { confirm: true } : {}),
    })) as PluginInstallPreview | PluginMutationResult;

    if ("needsConfirm" in payload && payload.needsConfirm) {
      setPendingInstall(payload);
      return;
    }

    setPendingInstall(undefined);
    setInstallSource("");
    markRestartIfNeeded(payload);
  };

  const runPluginMutation = async (
    path: string,
    body: Record<string, unknown>,
  ): Promise<PluginMutationResult> => {
    const payload = (await postJson(path, body)) as PluginMutationResult;
    markRestartIfNeeded(payload);
    return payload;
  };

  const doctor = snapshot.doctor;
  const doctorIssues = doctor?.issues ?? [];
  const doctorFixes = doctor?.fixesApplied ?? [];

  return (
    <section className="plugin-panel" aria-labelledby="plugin-panel-title">
      <div className="panel-heading">
        <div>
          <label id="plugin-panel-title">Plugins</label>
          <div className="meta-row">Manage installed plugins via the same registry as CLI.</div>
        </div>
        <button
          className="icon"
          title="Refresh plugins"
          aria-label="Refresh plugins"
          onClick={() => runAction(setErrorMessage, refresh, refresh)}
        >
          <RefreshCw size={16} aria-hidden />
        </button>
      </div>

      {restartRequired ? (
        <div className="meta-row warning plugin-restart-banner" role="status">
          <AlertTriangle size={16} aria-hidden />
          Restart RLM to load plugin changes. Tools are not updated until the session restarts.
        </div>
      ) : null}

      <div className="plugin-install">
        <input
          aria-label="Local path or remote URL"
          placeholder="Local path or remote URL"
          value={installSource}
          onChange={(event) => setInstallSource(event.target.value)}
        />
        <button
          disabled={installSource.trim().length === 0}
          onClick={() =>
            runAction(setErrorMessage, () => runInstall(installSource.trim()), refresh)
          }
        >
          <Download size={16} aria-hidden /> Install
        </button>
      </div>

      {pendingInstall ? (
        <div className="plugin-confirm" role="dialog" aria-labelledby="plugin-confirm-title">
          <div className="plugin-confirm-header">
            <Puzzle size={16} aria-hidden />
            <strong id="plugin-confirm-title">Remote plugin ready to install</strong>
          </div>
          <p>
            {pendingInstall.id}@{pendingInstall.manifest.version}
          </p>
          <div className="meta-row">Source: {pendingInstall.source}</div>
          <div className="meta-row">Category: {pendingInstall.manifest.category}</div>
          <div className="actions">
            <button
              onClick={() =>
                runAction(setErrorMessage, () => runInstall(pendingInstall.source, true), refresh)
              }
            >
              <Check size={16} aria-hidden /> Install (--yes)
            </button>
            <button className="secondary" onClick={() => setPendingInstall(undefined)}>
              <X size={16} aria-hidden /> Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div className="plugin-doctor">
        <div className="panel-heading">
          <label>Plugin doctor</label>
          <div className="actions">
            <button onClick={() => runAction(setErrorMessage, refresh, refresh)}>Run doctor</button>
            <button
              disabled={doctor?.ok !== false}
              onClick={() =>
                runAction(
                  setErrorMessage,
                  async () => {
                    await postJson("/api/plugins/doctor/fix", {});
                    setRestartRequired(true);
                  },
                  refresh,
                )
              }
            >
              Doctor --fix
            </button>
          </div>
        </div>
        {doctor && doctor.ok && doctorIssues.length === 0 && doctorFixes.length === 0 ? (
          <div className="meta-row">Plugin doctor: no issues found.</div>
        ) : null}
        {doctorIssues.map((issue, index) => (
          <div
            className={`meta-row ${issue.severity === "error" ? "warning" : ""}`}
            key={`${issue.code}-${issue.pluginId ?? index}`}
          >
            {formatDoctorIssue(issue)}
          </div>
        ))}
        {doctorFixes.map((fixMessage) => (
          <div className="meta-row" key={fixMessage}>
            FIX: {fixMessage}
          </div>
        ))}
      </div>

      {snapshot.plugins.length === 0 ? (
        <div className="empty session-empty">No plugins found.</div>
      ) : (
        <div className="plugin-list">
          {snapshot.plugins.map((plugin) => (
            <PluginRow
              key={plugin.id}
              plugin={plugin}
              refresh={refresh}
              setErrorMessage={setErrorMessage}
              runPluginMutation={runPluginMutation}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function PluginRow({
  plugin,
  refresh,
  setErrorMessage,
  runPluginMutation,
}: {
  plugin: PluginListItem;
  refresh: () => Promise<void>;
  setErrorMessage: (message: string | undefined) => void;
  runPluginMutation: (path: string, body: Record<string, unknown>) => Promise<PluginMutationResult>;
}) {
  const capabilityTags = [
    ...plugin.tools.map((tool) => `tool:${tool}`),
    ...plugin.skillLoaders.map((loader) => `skill:${loader}`),
    ...plugin.modelHosts.map((host) => `model:${host}`),
  ];
  const isBuiltin = plugin.source === "builtin";

  return (
    <div className={`plugin-row ${plugin.enabled ? "enabled" : "disabled"}`}>
      <div>
        <b>{plugin.name}</b>
        <div className="meta-row">{formatPluginLine(plugin)}</div>
        {capabilityTags.length > 0 ? (
          <div className="tag-row">
            {capabilityTags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        ) : null}
      </div>
      {isBuiltin ? null : (
        <div className="actions plugin-actions">
          <button
            disabled={plugin.enabled}
            onClick={() =>
              runAction(
                setErrorMessage,
                () => runPluginMutation("/api/plugins/enable", { id: plugin.id }),
                refresh,
              )
            }
          >
            Enable
          </button>
          <button
            disabled={!plugin.enabled}
            onClick={() =>
              runAction(
                setErrorMessage,
                () => runPluginMutation("/api/plugins/disable", { id: plugin.id }),
                refresh,
              )
            }
          >
            Disable
          </button>
          <button
            className="danger"
            onClick={() =>
              runAction(
                setErrorMessage,
                () => runPluginMutation("/api/plugins/uninstall", { id: plugin.id }),
                refresh,
              )
            }
          >
            <Trash2 size={16} aria-hidden /> Uninstall
          </button>
        </div>
      )}
    </div>
  );
}

function QualityLoopCardSummary({ loop }: { loop: QualityLoopMetadata }) {
  const score = loop.gate?.score ?? scoreFromSelection(loop.selection?.scoreBasis);
  const selected = loop.selectedCandidateId ?? "none";
  const issueCount = loop.unresolvedIssues.length;
  return (
    <div className={`loop-card-summary ${loop.status}`}>
      <div className="loop-summary-grid">
        <span>Status</span>
        <b>{loop.status}</b>
        <span>Score</span>
        <b>{score ?? "none"}</b>
        <span>Iterations</span>
        <b>
          {loop.usage.iterationsCompleted}/{loop.usage.iterationsStarted}
        </b>
        <span>Stop</span>
        <b>{loop.stopReason ?? "pending"}</b>
      </div>
      <div className="loop-selected">Selected: {selected}</div>
      {issueCount > 0 ? (
        <div className="loop-alert">
          {issueCount} unresolved issue{issueCount === 1 ? "" : "s"}
        </div>
      ) : null}
    </div>
  );
}

function SamplingRows({
  sampling,
  override,
}: {
  sampling?: ExecutionNode["effectiveSampling"];
  override?: SamplingOptions;
}) {
  const values = sampling?.values ?? {};
  const sources = sampling?.sources ?? {};
  const keys = ["temperature", "topP", "maxTokens"] as const;
  if (!sampling && !override) {
    return <div className="meta-row">Effective values pending.</div>;
  }
  return (
    <div className="sampling-rows">
      {keys.map((key) => (
        <div className="meta-row" key={key}>
          {key}: {values[key] ?? override?.[key] ?? "unset"} (
          {sources[key] ?? (override?.[key] !== undefined ? "node" : "pending")})
        </div>
      ))}
      {(sampling?.warnings ?? []).map((warning) => (
        <div className="meta-row warning" key={warning}>
          {warning}
        </div>
      ))}
    </div>
  );
}

function toInputValue(value: number | undefined): string {
  return value === undefined ? "" : String(value);
}

function parseOptionalNumber(value: string): number | undefined {
  const trimmed = value.trim();
  return trimmed === "" ? undefined : Number(trimmed);
}

function parseJsonObject(value: string): Record<string, string> {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return {};
  }
  const parsed = JSON.parse(trimmed) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Purpose tiers must be a JSON object.");
  }
  const normalized: Record<string, string> = {};
  for (const [key, raw] of Object.entries(parsed)) {
    if (typeof raw === "string" && raw.trim().length > 0) {
      normalized[key] = raw.trim();
    }
  }
  return normalized;
}

function NodeInspector({
  node,
  refresh,
  setErrorMessage,
  planningError,
}: {
  node: ExecutionNode;
  refresh: () => Promise<void>;
  setErrorMessage: (message: string | undefined) => void;
  planningError?: { nodeId: string; message: string } | undefined;
}) {
  const [prompt, setPrompt] = useState(node.prompt ?? node.label);
  const [modelOverride, setModelOverride] = useState(node.modelOverride ?? "");
  const [expertAgentId, setExpertAgentId] = useState<NonNullable<ExecutionNode["expertAgentId"]>>(
    node.expertAgentId ?? "default",
  );
  const [expertRuntime, setExpertRuntime] = useState<NonNullable<ExecutionNode["expertRuntime"]>>(
    node.expertRuntime ?? "single-pass",
  );
  const [expertTools, setExpertTools] = useState((node.expertToolAllowlist ?? []).join(", "));
  const [expertPurposeTiers, setExpertPurposeTiers] = useState(
    JSON.stringify(node.expertPurposeTiers ?? {}, null, 0),
  );
  const [temperature, setTemperature] = useState(toInputValue(node.samplingOverride?.temperature));
  const [topP, setTopP] = useState(toInputValue(node.samplingOverride?.topP));
  const [maxTokens, setMaxTokens] = useState(toInputValue(node.samplingOverride?.maxTokens));
  const [newChildPrompt, setNewChildPrompt] = useState("");
  const [connectParentId, setConnectParentId] = useState("");

  useEffect(() => {
    setPrompt(node.prompt ?? node.label);
    setModelOverride(node.modelOverride ?? "");
    setExpertAgentId(node.expertAgentId ?? "default");
    setExpertRuntime(node.expertRuntime ?? "single-pass");
    setExpertTools((node.expertToolAllowlist ?? []).join(", "));
    setExpertPurposeTiers(JSON.stringify(node.expertPurposeTiers ?? {}, null, 0));
    setTemperature(toInputValue(node.samplingOverride?.temperature));
    setTopP(toInputValue(node.samplingOverride?.topP));
    setMaxTokens(toInputValue(node.samplingOverride?.maxTokens));
  }, [
    node.expertAgentId,
    node.expertPurposeTiers,
    node.expertRuntime,
    node.expertToolAllowlist,
    node.id,
    node.label,
    node.prompt,
    node.samplingOverride?.maxTokens,
    node.samplingOverride?.temperature,
    node.samplingOverride?.topP,
  ]);

  const editable =
    node.status === "planned" || node.status === "ready" || node.status === "awaiting_approval";
  const waiting = node.status === "awaiting_approval";
  const composer = node.composer;

  return (
    <div className="node-inspector">
      <div>
        <label>Node</label>
        <h1>{node.id}</h1>
        {planningError?.nodeId === node.id ? (
          <p className="error" role="alert">
            {planningError.message}
          </p>
        ) : null}
      </div>
      {composer ? (
        <div className="composer-panel">
          <div className="composer-grid">
            <div>
              <label>Node type</label>
              <div className="meta-row strong">{composer.type}</div>
            </div>
            <div>
              <label>Runtime</label>
              <div className="meta-row strong">{composer.runtime}</div>
            </div>
            <div>
              <label>Complexity</label>
              <div className={`meta-row complexity ${composer.complexity}`}>
                {composer.complexity}
              </div>
            </div>
            <div>
              <label>Recommended</label>
              <div className="meta-row strong">{composer.recommendedAction}</div>
            </div>
          </div>
          <div>
            <label>Plan budget</label>
            <div className="budget-box">
              <span>
                Used {composer.planBudget.usedDepth}/{composer.planBudget.maxDepth} depth (cap)
              </span>
              <span>
                Used {composer.planBudget.usedNodes}/{composer.planBudget.maxNodes} nodes (cap)
              </span>
              <span>
                Remaining {composer.planBudget.remainingDepth} depth ·{" "}
                {composer.planBudget.remainingNodes} nodes
              </span>
              <span>{composer.planBudget.approvalRequired ? "approval required" : "auto"}</span>
              {composer.planBudget.exhausted ? (
                <span className="budget-stop">needs approval to expand</span>
              ) : null}
            </div>
          </div>
          <div>
            <label>Ports</label>
            <PortRows title="Inputs" ports={composer.inputs} />
            <PortRows title="Outputs" ports={composer.outputs} />
          </div>
          <div>
            <label>Context Policy</label>
            <PolicyRows title="Reads" items={composer.contextPolicy.reads} />
            <PolicyRows title="Writes" items={composer.contextPolicy.writes} />
            <PolicyRows title="Limits" items={composer.contextPolicy.limits} />
            <PolicyRows title="Memory" items={composer.contextPolicy.memoryScopes} />
          </div>
          <div>
            <label>Artifact refs</label>
            {composer.artifactRefs.length === 0 ? (
              <div className="meta-row">
                No artifact refs yet. Large payloads stay outside graph state.
              </div>
            ) : (
              composer.artifactRefs.map((artifact) => (
                <div className="artifact-row" key={artifact.id}>
                  <b>{artifact.id}</b>
                  <span>{artifact.mediaType}</span>
                  <span>{artifact.uri}</span>
                  {artifact.orderingKey ? <span>order={artifact.orderingKey}</span> : null}
                  {artifact.validation ? (
                    <span
                      className={`artifact-validation artifact-validation-${artifact.validation.state}`}
                    >
                      {artifact.validation.state}
                      {artifact.validation.policy ? ` (${artifact.validation.policy})` : ""}
                      {artifact.validation.reason ? `: ${artifact.validation.reason}` : ""}
                    </span>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
      <div>
        <label>Prompt</label>
        <textarea
          value={prompt}
          disabled={!editable}
          onChange={(event) => setPrompt(event.target.value)}
        />
      </div>
      <div>
        <label>Model Trail</label>
        <div className="meta-row">Planned: {node.plannedModel ?? "resolved-at-runtime"}</div>
        <div className="meta-row">Effective: {node.effectiveModel ?? "pending"}</div>
        <div className="meta-row">Override Source: {node.modelOverrideSource ?? "none"}</div>
      </div>
      <div>
        <label>Expert Binding</label>
        <div className="meta-row">Preset: {node.expertAgentId ?? "default"}</div>
        <div className="meta-row">Assignment: {node.expertAssignmentMode ?? "planner"}</div>
        <div className="meta-row">Runtime: {node.expertRuntime ?? "single-pass"}</div>
        <div className="meta-row">
          Tools: {(node.expertToolAllowlist ?? []).join(", ") || "agent default"}
        </div>
        <div className="meta-row">
          Purpose tiers: {JSON.stringify(node.expertPurposeTiers ?? {})}
        </div>
      </div>
      <div>
        <label>Sampling</label>
        <SamplingRows sampling={node.effectiveSampling} override={node.samplingOverride} />
      </div>
      <div>
        <label>Approval</label>
        <div className="meta-row">Mode: {approvalModeLabel(node.approvalMode ?? "full")}</div>
        <div className="meta-row">Source: {node.approvalSource ?? "none"}</div>
        <div className="meta-row">
          Spawned after initial approval: {String(node.spawnedAfterInitialApproval ?? false)}
        </div>
      </div>
      {node.loop ? (
        <QualityLoopInspector
          node={node}
          loop={node.loop}
          refresh={refresh}
          setErrorMessage={setErrorMessage}
        />
      ) : null}
      <div>
        <label>Model Override</label>
        <input
          value={modelOverride}
          disabled={!editable}
          onChange={(event) => setModelOverride(event.target.value)}
          placeholder="model-name"
        />
        <div className="actions">
          <button
            disabled={!editable || modelOverride.trim().length === 0}
            onClick={() =>
              runAction(
                setErrorMessage,
                () => post(`/api/nodes/${node.id}/model`, { model: modelOverride }),
                refresh,
              )
            }
          >
            Set model
          </button>
        </div>
      </div>
      <div>
        <label>Expert Override</label>
        <select
          value={expertAgentId}
          disabled={!editable}
          onChange={(event) =>
            setExpertAgentId(event.target.value as NonNullable<ExecutionNode["expertAgentId"]>)
          }
        >
          {["default", "coding", "qa", "product_designer", "research"].map((agent) => (
            <option key={agent} value={agent}>
              {agent}
            </option>
          ))}
        </select>
        <select
          value={expertRuntime}
          disabled={!editable}
          onChange={(event) =>
            setExpertRuntime(event.target.value as NonNullable<ExecutionNode["expertRuntime"]>)
          }
        >
          <option value="single-pass">single-pass</option>
          <option value="rlm">rlm</option>
        </select>
        <input
          value={expertTools}
          disabled={!editable}
          onChange={(event) => setExpertTools(event.target.value)}
          placeholder="shell, write_file"
        />
        <input
          value={expertPurposeTiers}
          disabled={!editable}
          onChange={(event) => setExpertPurposeTiers(event.target.value)}
          placeholder='{"answer":"small"}'
        />
        <div className="actions">
          <button
            disabled={!editable}
            onClick={() =>
              runAction(
                setErrorMessage,
                () =>
                  post(`/api/nodes/${node.id}/expert`, {
                    agentId: expertAgentId,
                    runtime: expertRuntime,
                    toolAllowlist: expertTools
                      .split(",")
                      .map((tool) => tool.trim())
                      .filter(Boolean),
                    purposeTiers: parseJsonObject(expertPurposeTiers),
                  }),
                refresh,
              )
            }
          >
            Set expert
          </button>
        </div>
      </div>
      <div>
        <label>Sampling Override</label>
        <div className="sampling-grid">
          <input
            value={temperature}
            disabled={!editable}
            onChange={(event) => setTemperature(event.target.value)}
            placeholder="temperature"
            inputMode="decimal"
          />
          <input
            value={topP}
            disabled={!editable}
            onChange={(event) => setTopP(event.target.value)}
            placeholder="top-p"
            inputMode="decimal"
          />
          <input
            value={maxTokens}
            disabled={!editable}
            onChange={(event) => setMaxTokens(event.target.value)}
            placeholder="max tokens"
            inputMode="numeric"
          />
        </div>
        <div className="actions">
          <button
            disabled={!editable}
            onClick={() =>
              runAction(
                setErrorMessage,
                () =>
                  post(`/api/nodes/${node.id}/sampling`, {
                    temperature: parseOptionalNumber(temperature),
                    topP: parseOptionalNumber(topP),
                    maxTokens: parseOptionalNumber(maxTokens),
                  }),
                refresh,
              )
            }
          >
            Set sampling
          </button>
        </div>
      </div>
      <div className="actions">
        <button
          disabled={!editable}
          onClick={() =>
            runAction(
              setErrorMessage,
              () => post(`/api/nodes/${node.id}/edit`, { prompt }),
              refresh,
            )
          }
        >
          Save prompt
        </button>
        <button
          disabled={!editable}
          onClick={() =>
            runAction(setErrorMessage, () => post(`/api/nodes/${node.id}/plan`, {}), refresh)
          }
        >
          <GitBranchPlus size={16} /> Plan children
        </button>
        <button
          disabled={!editable}
          onClick={() =>
            runAction(setErrorMessage, () => post(`/api/nodes/${node.id}/breakdown`, {}), refresh)
          }
        >
          <Scissors size={16} /> Break down
        </button>
        <button
          disabled={!editable || composer?.planBudget.exhausted !== true}
          onClick={() =>
            runAction(
              setErrorMessage,
              () => post(`/api/nodes/${node.id}/extend-budget`, {}),
              refresh,
            )
          }
        >
          Extend budget
        </button>
        <button
          disabled={!waiting}
          onClick={() =>
            runAction(
              setErrorMessage,
              () => post(`/api/nodes/${node.id}/approve`, { token: node.approvalToken }),
              refresh,
            )
          }
        >
          <Check size={16} /> Approve
        </button>
        <button
          disabled={!waiting}
          onClick={() =>
            runAction(
              setErrorMessage,
              () => post(`/api/nodes/${node.id}/skip`, { token: node.approvalToken }),
              refresh,
            )
          }
        >
          <X size={16} /> Skip
        </button>
      </div>
      <div>
        <label>Add Child</label>
        <textarea
          value={newChildPrompt}
          disabled={!editable}
          onChange={(event) => setNewChildPrompt(event.target.value)}
          placeholder="New child prompt"
        />
        <div className="actions">
          <button
            disabled={!editable || newChildPrompt.trim().length === 0}
            onClick={() =>
              runAction(
                setErrorMessage,
                () => post("/api/nodes/add", { parentId: node.id, prompt: newChildPrompt }),
                refresh,
              )
            }
          >
            Add child
          </button>
        </div>
      </div>
      <div>
        <label>Connect Parent ID</label>
        <input
          value={connectParentId}
          disabled={!editable}
          onChange={(event) => setConnectParentId(event.target.value)}
          placeholder="task-1"
        />
        <div className="actions">
          <button
            disabled={!editable || connectParentId.trim().length === 0}
            onClick={() =>
              runAction(
                setErrorMessage,
                () => post(`/api/nodes/${node.id}/connect`, { parentId: connectParentId }),
                refresh,
              )
            }
          >
            Connect
          </button>
          <button
            disabled={!editable}
            className="danger"
            onClick={() =>
              runAction(setErrorMessage, () => post(`/api/nodes/${node.id}/delete`, {}), refresh)
            }
          >
            <Trash2 size={16} /> Delete subtree
          </button>
        </div>
      </div>
    </div>
  );
}

function QualityLoopInspector({
  node,
  loop,
  refresh,
  setErrorMessage,
}: {
  node: ExecutionNode;
  loop: QualityLoopMetadata;
  refresh: () => Promise<void>;
  setErrorMessage: (message: string | undefined) => void;
}) {
  const score = loop.gate?.score ?? scoreFromSelection(loop.selection?.scoreBasis);
  const running = node.status === "running" || loop.status === "running";
  return (
    <div className="quality-loop-panel">
      <label>Quality Loop</label>
      <div className="loop-inspector-grid">
        <div className="meta-row strong">Status: {loop.status}</div>
        <div className="meta-row strong">Score: {score ?? "none"}</div>
        <div className="meta-row">
          Iterations: {loop.usage.iterationsCompleted}/{loop.usage.iterationsStarted}
        </div>
        <div className="meta-row">Stop reason: {loop.stopReason ?? "pending"}</div>
        <div className="meta-row">Selected: {loop.selectedCandidateId ?? "none"}</div>
        <div className="meta-row">Issues: {loop.unresolvedIssues.length}</div>
      </div>
      {loop.rubric ? (
        <div className="loop-detail-block">
          <b>{loop.rubric.label}</b>
          <span>
            {loop.rubric.id} · confidence {loop.rubric.confidence}
          </span>
          <p>{loop.rubric.rationale}</p>
        </div>
      ) : null}
      {loop.gate ? (
        <div className="loop-detail-block">
          <b>Gate: {loop.gate.decision}</b>
          <span>
            score {loop.gate.score} / threshold {loop.gate.passThreshold}
          </span>
          <p>{loop.gate.rationale}</p>
        </div>
      ) : null}
      {loop.selection ? (
        <div className="loop-detail-block">
          <b>Selection</b>
          <span>{loop.selection.selectedCandidateId}</span>
          <p>{loop.selection.rationale}</p>
        </div>
      ) : null}
      {loop.phaseModels ? (
        <div>
          <label>Loop Model Trail</label>
          {Object.values(loop.phaseModels).map((assignment) => (
            <div className="phase-row" key={assignment.phase}>
              <b>{phaseLabel(assignment.phase)}</b>
              <span>
                {assignment.plannedSelection} {"->"} {assignment.effectiveModel}
              </span>
              <span>{assignment.source}</span>
            </div>
          ))}
        </div>
      ) : null}
      <div>
        <label>Iterations</label>
        {loop.iterations.length === 0 ? (
          <div className="meta-row">No iterations yet.</div>
        ) : (
          loop.iterations.map((iteration) => (
            <details
              className="loop-iteration"
              key={iteration.index}
              open={iteration.index === loop.iterations.length - 1}
            >
              <summary>
                Iteration {iteration.index + 1}: {iteration.status}
              </summary>
              {iteration.critiqueEvaluation ? (
                <div className="meta-row">
                  Critique resolved: {String(iteration.critiqueEvaluation.resolved)} ·{" "}
                  {iteration.critiqueEvaluation.summary}
                </div>
              ) : null}
              {iteration.gateEvaluation ? (
                <div className="meta-row">
                  Gate: {iteration.gateEvaluation.decision} · score {iteration.gateEvaluation.score}{" "}
                  · critique resolved {String(iteration.gateEvaluation.critiqueResolved)}
                </div>
              ) : null}
              {iteration.phases.map((phase) => (
                <div className="phase-row" key={`${iteration.index}-${phase.phase}`}>
                  <b>{phaseLabel(phase.phase)}</b>
                  <span>{phase.status}</span>
                  <span>
                    {phase.modelSelection ?? phase.plannedModel ?? "resolved"} {"->"}{" "}
                    {phase.model ?? "pending"}
                  </span>
                  {phase.parseStatus ? <span>{phase.parseStatus}</span> : null}
                  {phase.summary ? <p>{phase.summary}</p> : null}
                </div>
              ))}
            </details>
          ))
        )}
      </div>
      {loop.unresolvedIssues.length > 0 ? (
        <div>
          <label>Loop Issues</label>
          {loop.unresolvedIssues.map((issue) => (
            <div className={`loop-issue ${issue.severity}`} key={issue.id}>
              <b>{issue.severity}</b>
              <span>{phaseLabel(issue.sourcePhase)}</span>
              <p>{issue.text}</p>
            </div>
          ))}
        </div>
      ) : null}
      <div className="actions">
        <button
          disabled={!running}
          onClick={() =>
            runAction(
              setErrorMessage,
              () =>
                post(`/api/nodes/${node.id}/quality-loop/accept`, {
                  reason: "accepted from quality-loop inspector",
                }),
              refresh,
            )
          }
        >
          <Check size={16} /> Accept loop
        </button>
        <button
          disabled={!running}
          className="danger"
          onClick={() =>
            runAction(
              setErrorMessage,
              () =>
                post(`/api/nodes/${node.id}/quality-loop/stop`, {
                  reason: "stopped from quality-loop inspector",
                }),
              refresh,
            )
          }
        >
          <Square size={16} /> Stop loop
        </button>
      </div>
    </div>
  );
}

function PortRows({
  title,
  ports,
}: {
  title: string;
  ports: NonNullable<ExecutionNode["composer"]>["inputs"];
}) {
  return (
    <div className="port-row-group">
      <span>{title}</span>
      {ports.map((port) => (
        <code key={port.id}>
          {port.label}: {port.artifactType}
        </code>
      ))}
    </div>
  );
}

function PolicyRows({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="policy-row">
      <span>{title}</span>
      <p>{items.join(", ")}</p>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
