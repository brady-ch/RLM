import type { ComponentType } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
  type NodeChange,
  type OnConnect,
} from "@xyflow/react";
import type { FlowNodeData } from "../shared/types";

export type GraphCanvasProps = {
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  nodeTypes: Record<string, ComponentType<{ data: FlowNodeData }>>;
  onNodesChange: (changes: NodeChange[]) => void;
  onConnect: OnConnect;
  onNodeDragStart: () => void;
  onNodeDragStop: () => void;
  onViewportMoveEnd: (event: unknown, viewport: { x: number; y: number; zoom: number }) => void;
  onInit: (instance: { setViewport: (v: { x: number; y: number; zoom: number }) => void }) => void;
  onNodeClick: (nodeId: string) => void;
  onPaneClick: () => void;
};

export function GraphCanvas({
  nodes,
  edges,
  nodeTypes,
  onNodesChange,
  onConnect,
  onNodeDragStart,
  onNodeDragStop,
  onViewportMoveEnd,
  onInit,
  onNodeClick,
  onPaneClick,
}: GraphCanvasProps) {
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onConnect={onConnect}
      nodesConnectable
      nodesDraggable
      onNodeDragStart={onNodeDragStart}
      onNodeDragStop={onNodeDragStop}
      onMoveEnd={onViewportMoveEnd}
      onInit={onInit}
      onNodeClick={(_, node) => onNodeClick(node.id)}
      onPaneClick={onPaneClick}
    >
      <Background gap={20} color="#d8ded9" />
      <MiniMap pannable zoomable />
      <Controls />
    </ReactFlow>
  );
}
