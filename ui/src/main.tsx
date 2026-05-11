import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Check, Edit3, Square, X } from "lucide-react";
import "./styles.css";

type ExecutionStatus =
  | "planned"
  | "ready"
  | "awaiting_approval"
  | "approved"
  | "running"
  | "completed"
  | "skipped"
  | "failed"
  | "cancelled";

type ExecutionNode = {
  id: string;
  parentId?: string;
  kind: "task" | "workflow-agent" | "workflow-qa";
  label: string;
  prompt?: string;
  originalPrompt?: string;
  approvalToken?: string;
  plannedModel?: string;
  effectiveModel?: string;
  modelOverride?: string;
  modelOverrideSource?: "user" | "none";
  approvalMode?: "full" | "initial-plan" | "initial-plan-recursive";
  approvalSource?: "manual" | "auto" | "none";
  approvalReason?: string;
  spawnedAfterInitialApproval?: boolean;
  autoApprovalPaused?: boolean;
  depth: number;
  status: ExecutionStatus;
};

type ExecutionGraph = {
  nodes: ExecutionNode[];
  edges: Array<{ from: string; to: string }>;
};

type SessionSnapshot = {
  graph: ExecutionGraph;
  status: ExecutionStatus;
  activeNodeId?: string;
  approvalMode: "full" | "initial-plan" | "initial-plan-recursive";
  autoApprovalPaused: boolean;
  runSummary?: { message?: string };
  chat?: {
    readiness: {
      state: "draft" | "ready_to_run";
      reason: string;
    };
    pendingMutation?: {
      id: string;
      summary: string;
      requiresClarification: boolean;
      clarificationQuestion?: string;
      requiresDeleteChoice: boolean;
      pendingDeleteChoice?: {
        nodeId: string;
        options: Array<"delete_subtree" | "rewire_dependents">;
      };
    };
    pendingClarification?: {
      questionId: string;
      nodeId: string;
      promptText: string;
      askedAt: string;
    };
    clarificationHistory: Array<{
      question_id: string;
      node_id: string;
      prompt_text: string;
      user_answer: string;
      asked_at: string;
      answered_at: string;
      resume_event_id: string;
    }>;
  };
};

/** Mirror `labelForCategory` / status strings in `src/domain/execution-failure.ts` for header copy. */
const uiRunStatusLabels: Record<ExecutionStatus, string> = {
  planned: "Planned",
  ready: "Ready",
  awaiting_approval: "Awaiting approval",
  approved: "Approved",
  running: "Running",
  completed: "Completed",
  skipped: "Skipped",
  failed: "Failed",
  cancelled: "Cancelled",
};

type FlowNodeData = {
  execution: ExecutionNode;
};

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
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [chatMessage, setChatMessage] = useState("");
  const [deleteStrategy, setDeleteStrategy] = useState<"delete_subtree" | "rewire_dependents">("delete_subtree");
  const [clarificationAnswer, setClarificationAnswer] = useState("");
  const selectedNode = snapshot.graph.nodes.find((node) => node.id === selectedNodeId) ?? snapshot.graph.nodes[0];
  const readiness = snapshot.chat?.readiness ?? {
    state: "draft" as const,
    reason: "Draft graph: confirm graph and run to start execution.",
  };
  const runDisabled = readiness.state !== "ready_to_run";
  const pendingMutation = snapshot.chat?.pendingMutation;
  const pendingClarification = snapshot.chat?.pendingClarification;
  const clarificationHistory = snapshot.chat?.clarificationHistory ?? [];

  const refresh = useCallback(async () => {
    const response = await fetch("/api/session");
    setSnapshot(await response.json() as SessionSnapshot);
  }, []);

  useEffect(() => {
    void refresh();
    const events = new EventSource("/api/events");
    events.addEventListener("snapshot", (event) => {
      setSnapshot(JSON.parse((event as MessageEvent).data) as SessionSnapshot);
    });
    events.addEventListener("execution", () => {
      void refresh();
    });
    return () => events.close();
  }, [refresh]);

  const nodes = useMemo<Array<Node<FlowNodeData>>>(() => snapshot.graph.nodes.map((node, index) => ({
    id: node.id,
    type: "execution",
    position: {
      x: node.depth * 320,
      y: index * 145,
    },
    data: { execution: node },
  })), [snapshot.graph.nodes]);

  const edges = useMemo<Edge[]>(() => snapshot.graph.edges.map((edge) => ({
    id: `${edge.from}-${edge.to}`,
    source: edge.from,
    target: edge.to,
    animated: true,
  })), [snapshot.graph.edges]);

  return (
    <main className="shell">
      <section className="canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={(_, node) => setSelectedNodeId(node.id)}
          fitView
        >
          <Background gap={20} color="#d8ded9" />
          <MiniMap pannable zoomable />
          <Controls />
        </ReactFlow>
      </section>
      <aside className="inspector">
        <header>
          <div className="run-status-block">
            <span className={`status ${snapshot.status}`} title={snapshot.runSummary?.message}>
              {uiRunStatusLabels[snapshot.status] ?? snapshot.status}
            </span>
            {snapshot.status === "failed" && snapshot.runSummary?.message
              ? <span className="run-failure-hint">{snapshot.runSummary.message}</span>
              : null}
          </div>
          <span className="meta-pill">{approvalModeLabel(snapshot.approvalMode)}</span>
          <button
            className="icon"
            onClick={() => runAction(setErrorMessage, () => post("/api/chat/confirm-run", {}), refresh)}
          >
            Confirm graph and run
          </button>
          <button
            className="icon"
            title="Pause future auto-approvals"
            onClick={() => runAction(setErrorMessage, () => post("/api/pause-future-auto-approvals", {}), refresh)}
          >
            Pause future auto
          </button>
          <button
            className="icon danger"
            title="Stop run"
            onClick={() => runAction(setErrorMessage, () => post("/api/stop", { reason: "stopped from UI" }), refresh)}
          >
            <Square size={16} />
          </button>
        </header>
        {errorMessage ? <p className="error">{errorMessage}</p> : null}
        <div className="node-inspector">
          <div>
            <label>Run control</label>
            <button disabled={runDisabled}>Run disabled until confirmed</button>
            {runDisabled ? <div className="meta-row">{readiness.reason}</div> : <div className="meta-row">Ready to run.</div>}
          </div>
          <div>
            <label>Chat mutation</label>
            <textarea
              value={chatMessage}
              onChange={(event) => setChatMessage(event.target.value)}
              placeholder="edit task-1: refine this prompt"
            />
            <div className="actions">
              <button
                disabled={chatMessage.trim().length === 0}
                onClick={() => runAction(setErrorMessage, () => post("/api/chat/message", { message: chatMessage }), refresh)}
              >
                Preview mutation
              </button>
              <button onClick={() => runAction(setErrorMessage, () => post("/api/chat/cancel", {}), refresh)}>Clear preview</button>
            </div>
            {pendingMutation
              ? (
                <div className="meta-row">
                  Pending: {pendingMutation.summary}
                  {pendingMutation.requiresDeleteChoice && pendingMutation.pendingDeleteChoice
                    ? (
                      <div className="actions">
                        <select value={deleteStrategy} onChange={(event) => setDeleteStrategy(event.target.value as "delete_subtree" | "rewire_dependents")}>
                          {pendingMutation.pendingDeleteChoice.options.map((option) => <option key={option} value={option}>{option}</option>)}
                        </select>
                        <button
                          onClick={() => runAction(
                            setErrorMessage,
                            () => post("/api/chat/apply", { proposalId: pendingMutation.id, deleteStrategy }),
                            refresh,
                          )}
                        >
                          Apply preview
                        </button>
                      </div>
                    )
                    : (
                      <div className="actions">
                        <button onClick={() => runAction(setErrorMessage, () => post("/api/chat/apply", { proposalId: pendingMutation.id }), refresh)}>
                          Apply preview
                        </button>
                      </div>
                    )}
                </div>
              )
              : <div className="meta-row">No pending mutation preview.</div>}
          </div>
          <div>
            <label>Clarification timeline</label>
            {pendingClarification
              ? (
                <div className="meta-row">
                  <div><b>Pending:</b> {pendingClarification.promptText}</div>
                  <div className="meta-row">node={pendingClarification.nodeId} asked={pendingClarification.askedAt}</div>
                  <textarea
                    value={clarificationAnswer}
                    onChange={(event) => setClarificationAnswer(event.target.value)}
                    placeholder="Type clarification answer"
                  />
                  <div className="actions">
                    <button
                      disabled={clarificationAnswer.trim().length === 0}
                      onClick={() => runAction(
                        setErrorMessage,
                        () => post("/api/clarifications/answer", {
                          questionId: pendingClarification.questionId,
                          userAnswer: clarificationAnswer,
                        }),
                        async () => {
                          setClarificationAnswer("");
                          await refresh();
                        },
                      )}
                    >
                      Answer and continue
                    </button>
                    <button
                      className="danger"
                      onClick={() => runAction(
                        setErrorMessage,
                        () => post("/api/clarifications/abort", { questionId: pendingClarification.questionId }),
                        refresh,
                      )}
                    >
                      Abort run
                    </button>
                  </div>
                </div>
              )
              : <div className="meta-row">No pending clarification.</div>}
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
        {selectedNode
          ? <NodeInspector node={selectedNode} refresh={refresh} setErrorMessage={setErrorMessage} />
          : <p className="empty">Waiting for execution graph.</p>}
      </aside>
    </main>
  );
}

function ExecutionNodeCard({ data }: { data: FlowNodeData }) {
  const node = data.execution;
  return (
    <div className={`node-card ${node.status}`}>
      <Handle type="target" position={Position.Left} />
      <div className="node-topline">
        <span>{node.kind}</span>
        <b>{node.status}</b>
      </div>
      <div className="node-title">{node.label}</div>
      <div className="node-models">
        <div>P: {node.plannedModel ?? "resolved-at-runtime"}</div>
        <div>E: {node.effectiveModel ?? "pending"}</div>
        <div>Mode: {node.approvalMode ?? "full"}</div>
        <div>Approval: {node.approvalSource ?? "none"}</div>
        {node.spawnedAfterInitialApproval ? <div className="badge">spawned branch</div> : null}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function NodeInspector(
  { node, refresh, setErrorMessage }: { node: ExecutionNode; refresh: () => Promise<void>; setErrorMessage: (message: string | undefined) => void },
) {
  const [prompt, setPrompt] = useState(node.prompt ?? node.label);
  const [modelOverride, setModelOverride] = useState(node.modelOverride ?? "");
  const [newChildPrompt, setNewChildPrompt] = useState("");
  const [connectParentId, setConnectParentId] = useState("");

  useEffect(() => {
    setPrompt(node.prompt ?? node.label);
    setModelOverride(node.modelOverride ?? "");
  }, [node.id, node.label, node.prompt]);

  const editable = node.status === "planned" || node.status === "ready" || node.status === "awaiting_approval";
  const waiting = node.status === "awaiting_approval";

  return (
    <div className="node-inspector">
      <div>
        <label>Node</label>
        <h1>{node.id}</h1>
      </div>
      <div>
        <label>Prompt</label>
        <textarea value={prompt} disabled={!editable} onChange={(event) => setPrompt(event.target.value)} />
      </div>
      <div>
        <label>Model Trail</label>
        <div className="meta-row">Planned: {node.plannedModel ?? "resolved-at-runtime"}</div>
        <div className="meta-row">Effective: {node.effectiveModel ?? "pending"}</div>
        <div className="meta-row">Override Source: {node.modelOverrideSource ?? "none"}</div>
      </div>
      <div>
        <label>Approval</label>
        <div className="meta-row">Mode: {approvalModeLabel(node.approvalMode ?? "full")}</div>
        <div className="meta-row">Source: {node.approvalSource ?? "none"}</div>
        <div className="meta-row">Spawned after initial approval: {String(node.spawnedAfterInitialApproval ?? false)}</div>
      </div>
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
            onClick={() => runAction(setErrorMessage, () => post(`/api/nodes/${node.id}/model`, { model: modelOverride }), refresh)}
          >
            Set model
          </button>
        </div>
      </div>
      <div className="actions">
        <button disabled={!editable} onClick={() => runAction(setErrorMessage, () => post(`/api/nodes/${node.id}/edit`, { prompt }), refresh)}>
          <Edit3 size={16} /> Edit
        </button>
        <button
          disabled={!waiting}
          onClick={() => runAction(setErrorMessage, () => post(`/api/nodes/${node.id}/approve`, { token: node.approvalToken }), refresh)}
        >
          <Check size={16} /> Approve
        </button>
        <button
          disabled={!waiting}
          onClick={() => runAction(setErrorMessage, () => post(`/api/nodes/${node.id}/skip`, { token: node.approvalToken }), refresh)}
        >
          <X size={16} /> Skip
        </button>
      </div>
      <div>
        <label>Add Child</label>
        <textarea
          value={newChildPrompt}
          disabled={!waiting}
          onChange={(event) => setNewChildPrompt(event.target.value)}
          placeholder="New child prompt"
        />
        <div className="actions">
          <button
            disabled={!waiting || newChildPrompt.trim().length === 0}
            onClick={() => runAction(setErrorMessage, () => post("/api/nodes/add", { parentId: node.id, prompt: newChildPrompt }), refresh)}
          >
            Add child
          </button>
        </div>
      </div>
      <div>
        <label>Connect Parent ID</label>
        <input
          value={connectParentId}
          disabled={!waiting}
          onChange={(event) => setConnectParentId(event.target.value)}
          placeholder="task-1"
        />
        <div className="actions">
          <button
            disabled={!waiting || connectParentId.trim().length === 0}
            onClick={() => runAction(setErrorMessage, () => post(`/api/nodes/${node.id}/connect`, { parentId: connectParentId }), refresh)}
          >
            Connect
          </button>
          <button
            disabled={!waiting}
            onClick={() => runAction(setErrorMessage, () => post(`/api/nodes/${node.id}/delete`, {}), refresh)}
          >
            Delete subtree
          </button>
        </div>
      </div>
    </div>
  );
}

async function runAction(
  setErrorMessage: (message: string | undefined) => void,
  operation: () => Promise<void>,
  refresh: () => Promise<void>,
) {
  try {
    setErrorMessage(undefined);
    await operation();
    await refresh();
  } catch (error) {
    setErrorMessage(error instanceof Error ? error.message : String(error));
    await refresh();
  }
}

async function post(path: string, body: Record<string, unknown>) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    try {
      const parsed = JSON.parse(text) as { error?: string; message?: string; details?: string; suggestedFix?: string };
      const parts = [parsed.error ?? parsed.message, parsed.details, parsed.suggestedFix].filter(Boolean);
      throw new Error(parts.join(" | "));
    } catch {
      throw new Error(text);
    }
  }
}

createRoot(document.getElementById("root")!).render(<App />);

function approvalModeLabel(mode: "full" | "initial-plan" | "initial-plan-recursive"): string {
  if (mode === "initial-plan") {
    return "Initial plan";
  }
  if (mode === "initial-plan-recursive") {
    return "Initial plan + recursive";
  }
  return "Full checkpoints";
}
