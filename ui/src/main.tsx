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
  });
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const selectedNode = snapshot.graph.nodes.find((node) => node.id === selectedNodeId) ?? snapshot.graph.nodes[0];

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
          <span className={`status ${snapshot.status}`}>{snapshot.status}</span>
          <button
            className="icon danger"
            title="Stop run"
            onClick={() => runAction(setErrorMessage, () => post("/api/stop", { reason: "stopped from UI" }), refresh)}
          >
            <Square size={16} />
          </button>
        </header>
        {errorMessage ? <p className="error">{errorMessage}</p> : null}
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
