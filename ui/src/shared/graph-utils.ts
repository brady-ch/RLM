import type { Edge, Node } from "@xyflow/react";
import type { ExecutionGraph, ExecutionNode, FlowNodeData } from "./types";

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

export function graphToFlowEdges(edges: ExecutionGraph["edges"]): Edge[] {
  return edges.map((edge, i) => ({
    id: `${edge.from}->${edge.to}-${i}`,
    source: edge.from,
    target: edge.to,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    animated: true,
  }));
}
