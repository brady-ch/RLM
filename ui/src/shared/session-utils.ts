import type { SessionSnapshot } from "./types";

export function isPristineFirstRunGraph(snapshot: SessionSnapshot): boolean {
  const { nodes, edges } = snapshot.graph;
  return nodes.length === 1 && nodes[0]?.id === "root-composer" && edges.length === 0;
}

export function rootComposerPrompt(snapshot: SessionSnapshot): string {
  const root = snapshot.graph.nodes.find((node) => node.id === "root-composer");
  return root?.prompt ?? "";
}
