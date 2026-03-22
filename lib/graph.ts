import type { ExplorationGraph, KnowledgeEdge, KnowledgeNode } from "@/lib/types";

export function mergeGraph(current: ExplorationGraph | null, incoming: ExplorationGraph): ExplorationGraph {
  if (!current) {
    return incoming;
  }

  const nodeMap = new Map<string, KnowledgeNode>();
  const edgeMap = new Map<string, KnowledgeEdge>();

  for (const node of current.nodes) {
    nodeMap.set(node.id, node);
  }

  for (const node of incoming.nodes) {
    nodeMap.set(node.id, node);
  }

  for (const edge of current.edges) {
    edgeMap.set(`${edge.source}:${edge.target}:${edge.label}`, edge);
  }

  for (const edge of incoming.edges) {
    edgeMap.set(`${edge.source}:${edge.target}:${edge.label}`, edge);
  }

  return {
    rootId: current.rootId,
    topic: current.topic,
    summary: current.summary,
    nodes: [...nodeMap.values()],
    edges: [...edgeMap.values()]
  };
}
