import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyNodeChanges,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type ReactFlowInstance,
} from "@xyflow/react";
import type { FlowNodeData, SessionSnapshot } from "../../shared/types";
import { executionToFlowNode, graphToFlowEdges } from "../../shared/graph-utils";
import { post, runAction } from "../../shared/api";
import { isPristineFirstRunGraph } from "../../shared/session-utils";

type UseGraphCanvasParams = {
  snapshot: SessionSnapshot;
  refresh: () => Promise<void>;
  setErrorMessage: (message: string | undefined) => void;
  planningNodeId: string | undefined;
  setPlanningNodeId: (id: string | undefined) => void;
  planningError: { nodeId: string; message: string } | undefined;
  setPlanningError: (error: { nodeId: string; message: string } | undefined) => void;
  selectedNodeId: string | undefined;
  setSelectedNodeId: (id: string | undefined) => void;
  onNavigateAdvancedSettings: () => void;
  launcherDismissed: boolean;
};

export function useGraphCanvas({
  snapshot,
  refresh,
  setErrorMessage,
  planningNodeId,
  setPlanningNodeId,
  planningError,
  setPlanningError,
  selectedNodeId,
  setSelectedNodeId,
  onNavigateAdvancedSettings,
  launcherDismissed,
}: UseGraphCanvasParams) {
  const [nodes, setNodes] = useState<Node<FlowNodeData>[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const draggingRef = useRef(false);
  const layoutFlushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingLayoutRef = useRef<Record<string, { x: number; y: number }>>({});
  const lastNodeDataSyncKey = useRef<string>("");
  const viewportFlushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rfInstanceRef = useRef<ReactFlowInstance<Node<FlowNodeData>, Edge> | null>(null);
  const prevGraphNodeIdsRef = useRef<string[]>([]);

  const fitGraphToView = useCallback(() => {
    requestAnimationFrame(() => {
      void rfInstanceRef.current?.fitView({ padding: 0.2, duration: 300 });
    });
  }, []);

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
          onNavigateAdvancedSettings,
        }),
      ),
    );
    setEdges(graphToFlowEdges(snapshot.graph.edges, snapshot.graph.nodes));
  }, [
    onNavigateAdvancedSettings,
    planningError,
    planningNodeId,
    refresh,
    selectedNodeId,
    setPlanningError,
    setPlanningNodeId,
    setErrorMessage,
    snapshot,
  ]);

  useEffect(() => {
    if (!isPristineFirstRunGraph(snapshot)) {
      return;
    }
    if (!launcherDismissed) {
      return;
    }
    setSelectedNodeId("root-composer");
    rfInstanceRef.current?.setViewport({ x: 260, y: 120, zoom: 1 });
  }, [launcherDismissed, setSelectedNodeId, snapshot]);

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
  }, [refresh, setErrorMessage]);

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
    [refresh, setErrorMessage],
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
    [refresh, setErrorMessage],
  );

  const onInit = useCallback((inst: ReactFlowInstance<Node<FlowNodeData>, Edge>) => {
    rfInstanceRef.current = inst;
  }, []);

  return {
    nodes,
    edges,
    onNodesChange,
    onConnect,
    onViewportMoveEnd,
    onInit,
    onNodeDragStart: () => {
      draggingRef.current = true;
    },
    onNodeDragStop: () => {
      draggingRef.current = false;
    },
  };
}
