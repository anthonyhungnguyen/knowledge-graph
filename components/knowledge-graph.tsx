"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DataSet, Network, type Edge, type IdType, type Node, type Options } from "vis-network/standalone";
import { getFocusNodeIds } from "../lib/graph";
import type { ExplorationGraph, KnowledgeNode } from "../lib/types";

type KnowledgeGraphProps = {
  graph: ExplorationGraph | null;
  isLoading: boolean;
  selectedNodeId: string | null;
  selectedNodeLabel: string | null;
  onNodeSelect: (node: KnowledgeNode) => void;
  onExpandRelated: () => void;
  onExpandDeeper: () => void;
};

function fillForType(type: KnowledgeNode["type"]) {
  switch (type) {
    case "topic":
      return {
        background: "#2d4c78",
        border: "#b9cde8",
        highlight: {
          background: "#2d4c78",
          border: "#eef4fb"
        }
      };
    case "process":
      return {
        background: "#41635a",
        border: "#cedfd8",
        highlight: {
          background: "#41635a",
          border: "#eef4fb"
        }
      };
    case "example":
      return {
        background: "#8e6748",
        border: "#e5d6c8",
        highlight: {
          background: "#8e6748",
          border: "#eef4fb"
        }
      };
    case "person":
      return {
        background: "#6d5872",
        border: "#ddd2e0",
        highlight: {
          background: "#6d5872",
          border: "#eef4fb"
        }
      };
    default:
      return {
        background: "#5a6775",
        border: "#d6dde6",
        highlight: {
          background: "#5a6775",
          border: "#eef4fb"
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
      size: node.type === "topic" ? (isSelected ? 34 : 30) : isSelected ? 22 : 18,
      font: {
        color: isFocused ? "#f3f7fd" : "rgba(243, 247, 253, 0.24)",
        size: node.type === "topic" ? 16 : 13,
        face: "system-ui, sans-serif",
        strokeWidth: 0
      },
      color: isFocused
        ? fillForType(node.type)
        : {
            background: "rgba(128, 141, 157, 0.16)",
            border: "rgba(189, 204, 224, 0.16)",
            highlight: {
              background: "rgba(128, 141, 157, 0.16)",
              border: "rgba(189, 204, 224, 0.16)"
            }
          },
      borderWidth: isSelected ? 3 : node.type === "topic" ? 2.5 : 1.5
    };
  });

  const edges: Edge[] = graph.edges.map((edge, index) => {
    const isFocusedEdge = !selectedNodeId || edge.source === selectedNodeId || edge.target === selectedNodeId;
    const showEdgeLabel = Boolean(selectedNodeId) && isFocusedEdge;

    return {
      id: `${edge.source}:${edge.target}:${edge.label}:${index}`,
      from: edge.source,
      to: edge.target,
      label: showEdgeLabel ? edge.label : undefined,
      color: {
        color: isFocusedEdge ? "rgba(214, 224, 244, 0.22)" : "rgba(214, 224, 244, 0.08)",
        highlight: "rgba(214, 224, 244, 0.22)",
        hover: "rgba(214, 224, 244, 0.22)"
      },
      font: showEdgeLabel
        ? {
            color: "rgba(229, 236, 246, 0.74)",
            size: 10,
            face: "system-ui, sans-serif",
            background: "rgba(14, 22, 34, 0.84)",
            strokeWidth: 0
          }
        : undefined,
      width: isFocusedEdge ? 1.15 : 0.75,
      selectionWidth: 1.4,
      smooth: {
        enabled: false,
        type: "continuous",
        roundness: 0
      }
    };
  });

  return { nodes, edges };
}

function withStoredPositions(graph: ExplorationGraph, nodes: Node[], positionCache: Map<string, { x: number; y: number }>) {
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
    hover: false,
    navigationButtons: false,
    keyboard: false,
    dragNodes: false,
    hideEdgesOnDrag: true,
    hideNodesOnDrag: false,
    hideEdgesOnZoom: true,
    selectConnectedEdges: false,
    zoomView: true,
    dragView: true
  },
  physics: {
    enabled: false
  },
  nodes: {
    shape: "dot"
  },
  edges: {
    selectionWidth: 1.4
  },
  layout: {
    improvedLayout: false
  }
};

export function KnowledgeGraph({
  graph,
  isLoading,
  selectedNodeId,
  selectedNodeLabel,
  onNodeSelect,
  onExpandRelated,
  onExpandDeeper
}: KnowledgeGraphProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const networkRef = useRef<Network | null>(null);
  const dataRef = useRef<{ nodes: DataSet<Node>; edges: DataSet<Edge> } | null>(null);
  const positionCacheRef = useRef(new Map<string, { x: number; y: number }>());
  const currentRootIdRef = useRef<string | null>(null);
  const nodeByIdRef = useRef<Map<string, KnowledgeNode>>(new Map());
  const [actionPosition, setActionPosition] = useState<{ left: number; top: number } | null>(null);
  const nodeById = useMemo(() => new Map(graph?.nodes.map((node) => [node.id, node]) ?? []), [graph]);

  function updateActionPosition() {
    const network = networkRef.current;
    const container = containerRef.current;

    if (!network || !container || !selectedNodeId) {
      setActionPosition(null);
      return;
    }

    const positions = network.getPositions([selectedNodeId]);
    const position = positions[selectedNodeId];

    if (!position) {
      setActionPosition(null);
      return;
    }

    const domPosition = network.canvasToDOM(position);
    const left = Math.min(Math.max(domPosition.x + 18, 20), Math.max(container.clientWidth - 212, 20));
    const top = Math.min(Math.max(domPosition.y - 18, 20), Math.max(container.clientHeight - 72, 20));

    setActionPosition({ left, top });
  }

  useEffect(() => {
    nodeByIdRef.current = nodeById;
  }, [nodeById]);

  useEffect(() => {
    if (!graph || !containerRef.current) {
      networkRef.current?.destroy();
      networkRef.current = null;
      dataRef.current = null;
      setActionPosition(null);
      return;
    }

    const previousRootId = currentRootIdRef.current;
    const isNewRoot = previousRootId !== graph.rootId;

    if (isNewRoot) {
      positionCacheRef.current = new Map();
    }

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

    currentRootIdRef.current = graph.rootId;

    const data = {
      nodes: new DataSet<Node>(positionedNodes),
      edges: new DataSet<Edge>(built.edges)
    };

    networkRef.current?.destroy();

    const network = new Network(containerRef.current, data, networkOptions);

    network.on("click", (params?: { nodes?: IdType[] }) => {
      const clickedNodeId = params?.nodes?.[0];

      if (clickedNodeId) {
        const selectedNode = nodeByIdRef.current.get(String(clickedNodeId));

        if (selectedNode) {
          onNodeSelect(selectedNode);
        }
        return;
      }

      const rootNode = nodeByIdRef.current.get(graph.rootId);

      if (rootNode) {
        onNodeSelect(rootNode);
      }
    });

    network.on("dragStart", () => {
      setActionPosition(null);
    });

    network.on("dragEnd", () => {
      updateActionPosition();
    });

    network.on("zoom", () => {
      updateActionPosition();
    });

    networkRef.current = network;
    dataRef.current = data;

    window.setTimeout(() => {
      updateActionPosition();
    }, 0);

    return () => {
      network.destroy();
    };
  }, [graph, onNodeSelect, selectedNodeId]);

  useEffect(() => {
    const network = networkRef.current;
    const data = dataRef.current;

    if (!network || !data || !graph) {
      return;
    }

    const built = buildItems(graph, selectedNodeId);

    data.nodes.update(withStoredPositions(graph, built.nodes, positionCacheRef.current));
    data.edges.clear();
    data.edges.add(built.edges);

    if (!selectedNodeId) {
      network.unselectAll();
      setActionPosition(null);
      return;
    }

    network.selectNodes([selectedNodeId]);
    network.focus(selectedNodeId, {
      scale: 1.02,
      animation: {
        duration: 180,
        easingFunction: "easeInOutQuad"
      }
    });

    window.setTimeout(() => {
      updateActionPosition();
    }, 200);
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
      {actionPosition && selectedNodeId ? (
        <div
          className="graph-node-actions"
          style={{
            left: `${actionPosition.left}px`,
            top: `${actionPosition.top}px`
          }}
        >
          <span className="graph-node-actions-label">{selectedNodeLabel ?? "Selection"}</span>
          <button type="button" className="graph-node-action" onClick={onExpandRelated}>
            Related
          </button>
          <button type="button" className="graph-node-action graph-node-action-secondary" onClick={onExpandDeeper}>
            Deeper
          </button>
        </div>
      ) : null}
      {isLoading ? (
        <div className="graph-loading-overlay">
          <div className="graph-loading-pill">Updating map</div>
        </div>
      ) : null}
    </div>
  );
}
