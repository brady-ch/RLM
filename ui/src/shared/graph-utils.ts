import type { Edge, Node } from "@xyflow/react";
import type { ExecutionGraph, ExecutionNode, FlowNodeData } from "./types";

const EDGE_STATUS_CLASS: Partial<Record<ExecutionNode["status"], string>> = {
  running: "edge-running",
  completed: "edge-completed",
  failed: "edge-failed",
  cancelled: "edge-failed",
};

export function executionToFlowNode(
  node: ExecutionNode,
  index: number,
  data: Omit<FlowNodeData, "execution"> = {},
): Node<FlowNodeData> {
  return {
    id: node.id,
    type: "execution",
    position: node.position ?? { x: node.depth * 430, y: index * 245 },
    data: { execution: node, ...data },
  };
}

export function graphToFlowEdges(
  edges: ExecutionGraph["edges"],
  nodes: ExecutionNode[] = [],
): Edge[] {
  const statusById = new Map(nodes.map((node) => [node.id, node.status]));
  return edges.map((edge, i) => {
    const targetStatus = statusById.get(edge.to);
    const statusClass = targetStatus ? EDGE_STATUS_CLASS[targetStatus] : undefined;
    return {
      id: `${edge.from}->${edge.to}-${i}`,
      source: edge.from,
      target: edge.to,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      animated: targetStatus === "running",
      className: statusClass ? `graph-edge ${statusClass}` : "graph-edge",
    };
  });
}
