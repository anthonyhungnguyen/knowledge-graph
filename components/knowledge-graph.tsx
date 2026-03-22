"use client";

import { useEffect, useMemo, useRef } from "react";
import { DataSet, Network, type Edge, type IdType, type Node, type Options } from "vis-network/standalone";
import { getFocusNodeIds } from "@/lib/graph";
import type { ExplorationGraph, KnowledgeNode } from "@/lib/types";

type KnowledgeGraphProps = {
  graph: ExplorationGraph | null;
  selectedNodeId: string | null;
  onNodeSelect: (node: KnowledgeNode) => void;
};

function fillForType(type: KnowledgeNode["type"]) {
  switch (type) {
    case "topic":
      return {
        background: "#2f80ff",
        border: "#d9eeff",
        highlight: {
          background: "#58a6ff",
          border: "#ffffff"
        }
      };
    case "process":
      return {
        background: "#0ea77f",
        border: "#d6fff0",
        highlight: {
          background: "#2ecf9e",
          border: "#ffffff"
        }
      };
    case "example":
      return {
        background: "#f19a3e",
        border: "#fff0d9",
        highlight: {
          background: "#ffb968",
          border: "#ffffff"
        }
      };
    case "person":
      return {
        background: "#d55078",
        border: "#ffe1ea",
        highlight: {
          background: "#ef7096",
          border: "#ffffff"
        }
      };
    default:
      return {
        background: "#49617c",
        border: "#dbe7f4",
        highlight: {
          background: "#6483a5",
          border: "#ffffff"
        }
      };
  }
}

function buildItems(graph: ExplorationGraph, selectedNodeId: string | null) {
  const focusedNodeIds = getFocusNodeIds(graph, selectedNodeId);

  const nodes: Node[] = graph.nodes.map((node) => {
    const isFocused = focusedNodeIds.has(node.id);
    const isSelected = node.id === selectedNodeId;

    return {
      id: node.id,
      label: node.label,
      shape: "dot",
      size: node.type === "topic" ? (isSelected ? 42 : 38) : isSelected ? 30 : 26,
      font: {
        color: isFocused ? "#f7fbff" : "rgba(247, 251, 255, 0.32)",
        size: node.type === "topic" ? 18 : 14,
        face: "Inter, ui-sans-serif, system-ui, sans-serif",
        strokeWidth: 0
      },
      color: isFocused
        ? fillForType(node.type)
        : {
            background: "rgba(84, 100, 122, 0.22)",
            border: "rgba(189, 204, 224, 0.22)",
            highlight: {
              background: "rgba(84, 100, 122, 0.22)",
              border: "rgba(189, 204, 224, 0.22)"
            }
          },
      borderWidth: isSelected ? 4 : node.type === "topic" ? 3 : 2,
      shadow: {
        enabled: isFocused,
        color: "rgba(3, 10, 19, 0.28)",
        size: 24,
        x: 0,
        y: 12
      },
      mass: node.type === "topic" ? 4 : 2.2
    };
  });

  const edges: Edge[] = graph.edges.map((edge, index) => {
    const isFocusedEdge = !selectedNodeId || edge.source === selectedNodeId || edge.target === selectedNodeId;

    return {
      id: `${edge.source}-${edge.target}-${index}`,
      from: edge.source,
      to: edge.target,
      label: edge.label,
      color: {
        color: isFocusedEdge ? "rgba(224, 231, 255, 0.22)" : "rgba(224, 231, 255, 0.08)",
        highlight: "rgba(224, 231, 255, 0.42)",
        hover: "rgba(224, 231, 255, 0.36)"
      },
      font: {
        color: isFocusedEdge ? "rgba(232, 238, 247, 0.78)" : "rgba(232, 238, 247, 0.24)",
        size: 11,
        face: "Inter, ui-sans-serif, system-ui, sans-serif",
        background: isFocusedEdge ? "rgba(10, 17, 28, 0.9)" : "rgba(10, 17, 28, 0.42)",
        strokeWidth: 0
      },
      width: isFocusedEdge ? 1.5 : 1,
      selectionWidth: 2.2,
      smooth: {
        enabled: true,
        type: "dynamic",
        roundness: 0.28
      },
      arrows: {
        to: {
          enabled: true,
          scaleFactor: 0.6
        }
      }
    };
  });

  return { nodes, edges };
}

function withStoredPositions(
  graph: ExplorationGraph,
  nodes: Node[],
  positionCache: Map<string, { x: number; y: number }>
) {
  const nextPositions = new Map(positionCache);
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  const childrenBySource = new Map<string, string[]>();
  const depthById = new Map<string, number>([[graph.rootId, 0]]);
  const queue = [graph.rootId];

  if (!nextPositions.has(graph.rootId)) {
    nextPositions.set(graph.rootId, { x: 0, y: 0 });
  }

  for (const edge of graph.edges) {
    const currentChildren = childrenBySource.get(edge.source) ?? [];
    currentChildren.push(edge.target);
    childrenBySource.set(edge.source, currentChildren);
  }

  while (queue.length > 0) {
    const currentId = queue.shift();

    if (!currentId) {
      continue;
    }

    const currentDepth = depthById.get(currentId) ?? 0;
    const children = childrenBySource.get(currentId) ?? [];

    children.forEach((childId) => {
      if (!depthById.has(childId) && nodeIds.has(childId)) {
        depthById.set(childId, currentDepth + 1);
        queue.push(childId);
      }
    });

    const missingChildren = children.filter((childId) => nodeIds.has(childId) && !nextPositions.has(childId));

    if (missingChildren.length === 0) {
      continue;
    }

    const parentPosition = nextPositions.get(currentId) ?? { x: 0, y: 0 };
    const parentAngle = currentId === graph.rootId ? -Math.PI / 2 : Math.atan2(parentPosition.y, parentPosition.x);
    const radius = currentId === graph.rootId ? 260 : 190;
    const spread = currentId === graph.rootId ? Math.PI * 1.7 : Math.min(Math.PI * 1.15, Math.max(Math.PI / 2, missingChildren.length * 0.55));
    const startAngle = parentAngle - spread / 2;

    missingChildren.forEach((childId, index) => {
      const angle = startAngle + (spread * (index + 1)) / (missingChildren.length + 1);
      nextPositions.set(childId, {
        x: parentPosition.x + Math.cos(angle) * radius,
        y: parentPosition.y + Math.sin(angle) * radius
      });
    });
  }

  const unpositionedNodes = graph.nodes.filter((node) => !nextPositions.has(node.id));

  unpositionedNodes.forEach((node, index) => {
    const angle = (Math.PI * 2 * index) / Math.max(unpositionedNodes.length, 1);
    nextPositions.set(node.id, {
      x: Math.cos(angle) * 340,
      y: Math.sin(angle) * 340
    });
  });

  return nodes.map((node) => {
    const position = nextPositions.get(String(node.id));

    if (!position) {
      return node;
    }

    return {
      ...node,
      x: position.x,
      y: position.y
    };
  });
}

const networkOptions: Options = {
  autoResize: true,
  interaction: {
    hover: true,
    tooltipDelay: 120,
    navigationButtons: false,
    keyboard: false
  },
  physics: {
    enabled: false
  },
  nodes: {
    shape: "dot"
  },
  edges: {
    selectionWidth: 2
  }
};

export function KnowledgeGraph({ graph, selectedNodeId, onNodeSelect }: KnowledgeGraphProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const networkRef = useRef<Network | null>(null);
  const dataRef = useRef<{ nodes: DataSet<Node>; edges: DataSet<Edge> } | null>(null);
  const positionCacheRef = useRef(new Map<string, { x: number; y: number }>());
  const currentRootIdRef = useRef<string | null>(null);
  const nodeByIdRef = useRef<Map<string, KnowledgeNode>>(new Map());
  const onNodeSelectRef = useRef(onNodeSelect);
  const nodeById = useMemo(() => new Map(graph?.nodes.map((node) => [node.id, node]) ?? []), [graph]);

  useEffect(() => {
    nodeByIdRef.current = nodeById;
    onNodeSelectRef.current = onNodeSelect;
  }, [nodeById, onNodeSelect]);

  useEffect(() => {
    if (!graph || !containerRef.current || networkRef.current) {
      return;
    }

    const data = {
      nodes: new DataSet<Node>(),
      edges: new DataSet<Edge>()
    };
    const network = new Network(containerRef.current, data, networkOptions);

    network.on("click", (params?: { nodes?: IdType[] }) => {
      const clickedNodeId = params?.nodes?.[0];

      if (clickedNodeId) {
        const node = nodeByIdRef.current.get(String(clickedNodeId));

        if (node) {
          onNodeSelectRef.current(node);
        }
        return;
      }

      const rootNodeId = currentRootIdRef.current;
      const rootNode = rootNodeId ? nodeByIdRef.current.get(rootNodeId) : null;

      if (rootNode) {
        onNodeSelectRef.current(rootNode);
      }
    });

    networkRef.current = network;
    dataRef.current = data;
  }, [graph]);

  useEffect(() => {
    return () => {
      networkRef.current?.destroy();
      networkRef.current = null;
      dataRef.current = null;
    };
  }, []);

  useEffect(() => {
    const network = networkRef.current;
    const data = dataRef.current;

    if (!network || !data || !graph) {
      return;
    }

    const previousRootId = currentRootIdRef.current;
    const isNewRoot = previousRootId !== graph.rootId;

    if (isNewRoot) {
      positionCacheRef.current = new Map();
    } else {
      const currentPositions = network.getPositions();

      Object.entries(currentPositions).forEach(([id, position]) => {
        positionCacheRef.current.set(id, {
          x: position.x,
          y: position.y
        });
      });
    }

    currentRootIdRef.current = graph.rootId;

    const built = buildItems(graph, selectedNodeId);
    const positionedNodes = withStoredPositions(graph, built.nodes, positionCacheRef.current);

    positionCacheRef.current = new Map(
      positionedNodes.map((node) => [
        String(node.id),
        {
          x: node.x ?? 0,
          y: node.y ?? 0
        }
      ])
    );

    data.nodes.clear();
    data.edges.clear();
    data.nodes.add(positionedNodes);
    data.edges.add(built.edges);

    if (isNewRoot) {
      network.fit({
        animation: {
          duration: 350,
          easingFunction: "easeInOutQuad"
        }
      });
    }

    if (!selectedNodeId) {
      network.unselectAll();
      return;
    }

    network.selectNodes([selectedNodeId]);
    network.focus(selectedNodeId, {
      scale: 1.05,
      animation: {
        duration: 350,
        easingFunction: "easeInOutQuad"
      }
    });
  }, [graph, selectedNodeId]);

  if (!graph) {
    return (
      <div className="graph-empty">
        <p>Enter a topic to begin.</p>
      </div>
    );
  }

  return (
    <div className="graph-shell">
      <div ref={containerRef} className="graph-canvas graph-vis" />
    </div>
  );
}
