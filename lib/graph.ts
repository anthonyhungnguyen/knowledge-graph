import type { ExplorationGraph, GraphNodeType, KnowledgeEdge, KnowledgeNode } from "@/lib/types";

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
    edges: [...edgeMap.values()],
    source: current.source === incoming.source ? current.source : "mixed",
    notice: incoming.notice ?? current.notice
  };
}

export function getFocusNodeIds(graph: ExplorationGraph, selectedNodeId: string | null): Set<string> {
  if (!selectedNodeId) {
    return new Set(graph.nodes.map((node) => node.id));
  }

  const focused = new Set<string>([selectedNodeId]);

  for (const edge of graph.edges) {
    if (edge.source === selectedNodeId) {
      focused.add(edge.target);
    }

    if (edge.target === selectedNodeId) {
      focused.add(edge.source);
    }
  }

  return focused;
}

function buildParentMap(edges: KnowledgeEdge[], startId: string, directed: boolean) {
  const queue = [startId];
  const seen = new Set<string>([startId]);
  const parents = new Map<string, string | null>([[startId, null]]);

  while (queue.length > 0) {
    const current = queue.shift();

    if (!current) {
      continue;
    }

    for (const edge of edges) {
      if (edge.source === current && !seen.has(edge.target)) {
        seen.add(edge.target);
        parents.set(edge.target, current);
        queue.push(edge.target);
      }

      if (!directed && edge.target === current && !seen.has(edge.source)) {
        seen.add(edge.source);
        parents.set(edge.source, current);
        queue.push(edge.source);
      }
    }
  }

  return parents;
}

export function getPathToNode(graph: ExplorationGraph, targetNodeId: string | null): KnowledgeNode[] {
  if (!targetNodeId) {
    return [];
  }

  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));

  if (!nodeById.has(targetNodeId)) {
    return [];
  }

  const directedParents = buildParentMap(graph.edges, graph.rootId, true);
  const fallbackParents = directedParents.has(targetNodeId)
    ? directedParents
    : buildParentMap(graph.edges, graph.rootId, false);

  if (!fallbackParents.has(targetNodeId)) {
    return [];
  }

  const path: KnowledgeNode[] = [];
  let currentId: string | null = targetNodeId;

  while (currentId) {
    const node = nodeById.get(currentId);

    if (node) {
      path.unshift(node);
    }

    currentId = fallbackParents.get(currentId) ?? null;
  }

  return path;
}

export function filterGraphByType(
  graph: ExplorationGraph,
  filter: GraphNodeType | "all",
  selectedNodeId: string | null
): ExplorationGraph {
  if (filter === "all") {
    return graph;
  }

  const visibleNodeIds = new Set(
    graph.nodes
      .filter((node) => node.type === "topic" || node.type === filter || node.id === selectedNodeId)
      .map((node) => node.id)
  );

  const visibleEdges = graph.edges.filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target));
  const connectedNodeIds = new Set<string>([graph.rootId]);

  for (const edge of visibleEdges) {
    connectedNodeIds.add(edge.source);
    connectedNodeIds.add(edge.target);
  }

  const visibleNodes = graph.nodes.filter((node) => connectedNodeIds.has(node.id) || node.id === selectedNodeId);

  return {
    ...graph,
    nodes: visibleNodes,
    edges: visibleEdges
  };
}
