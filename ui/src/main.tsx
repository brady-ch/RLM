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
          <button className="icon danger" title="Stop run" onClick={() => post("/api/stop", { reason: "stopped from UI" }).then(refresh)}>
            <Square size={16} />
          </button>
        </header>
        {selectedNode ? <NodeInspector node={selectedNode} refresh={refresh} /> : <p className="empty">Waiting for execution graph.</p>}
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
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function NodeInspector({ node, refresh }: { node: ExecutionNode; refresh: () => Promise<void> }) {
  const [prompt, setPrompt] = useState(node.prompt ?? node.label);

  useEffect(() => {
    setPrompt(node.prompt ?? node.label);
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
      <div className="actions">
        <button disabled={!editable} onClick={() => post(`/api/nodes/${node.id}/edit`, { prompt }).then(refresh)}>
          <Edit3 size={16} /> Edit
        </button>
        <button disabled={!waiting} onClick={() => post(`/api/nodes/${node.id}/approve`, {}).then(refresh)}>
          <Check size={16} /> Approve
        </button>
        <button disabled={!waiting} onClick={() => post(`/api/nodes/${node.id}/skip`, {}).then(refresh)}>
          <X size={16} /> Skip
        </button>
      </div>
    </div>
  );
}

async function post(path: string, body: Record<string, unknown>) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
}

createRoot(document.getElementById("root")!).render(<App />);
