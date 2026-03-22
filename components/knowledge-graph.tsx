"use client";

import { useMemo } from "react";
import type { ExplorationGraph, KnowledgeNode } from "@/lib/types";

type PositionedNode = {
  node: KnowledgeNode;
  x: number;
  y: number;
};

type KnowledgeGraphProps = {
  graph: ExplorationGraph | null;
  selectedNodeId: string | null;
  isLoading: boolean;
  onNodeSelect: (node: KnowledgeNode) => void;
  onNodeExpand: (node: KnowledgeNode) => void;
};

const graphWidth = 760;
const graphHeight = 520;
const centerX = graphWidth / 2;
const centerY = graphHeight / 2;

function buildAdjacency(graph: ExplorationGraph) {
  const adjacency = new Map<string, Set<string>>();

  for (const edge of graph.edges) {
    if (!adjacency.has(edge.source)) {
      adjacency.set(edge.source, new Set());
    }

    if (!adjacency.has(edge.target)) {
      adjacency.set(edge.target, new Set());
    }

    adjacency.get(edge.source)?.add(edge.target);
    adjacency.get(edge.target)?.add(edge.source);
  }

  return adjacency;
}

function buildLevels(graph: ExplorationGraph) {
  const levels = new Map<string, number>();
  const adjacency = buildAdjacency(graph);
  const queue = [graph.rootId];

  levels.set(graph.rootId, 0);

  while (queue.length > 0) {
    const current = queue.shift();

    if (!current) {
      continue;
    }

    const currentLevel = levels.get(current) ?? 0;
    const neighbors = adjacency.get(current) ?? new Set<string>();

    for (const neighbor of neighbors) {
      if (levels.has(neighbor)) {
        continue;
      }

      levels.set(neighbor, currentLevel + 1);
      queue.push(neighbor);
    }
  }

  return levels;
}

function layoutNodes(graph: ExplorationGraph): PositionedNode[] {
  const levels = buildLevels(graph);
  const nodesByLevel = new Map<number, KnowledgeNode[]>();

  for (const node of graph.nodes) {
    const level = levels.get(node.id) ?? 1;

    if (!nodesByLevel.has(level)) {
      nodesByLevel.set(level, []);
    }

    nodesByLevel.get(level)?.push(node);
  }

  const positions: PositionedNode[] = [];
  const maxLevel = Math.max(...nodesByLevel.keys(), 0);
  const radiusStep = maxLevel > 0 ? 150 / maxLevel : 0;

  for (const [level, levelNodes] of [...nodesByLevel.entries()].sort((a, b) => a[0] - b[0])) {
    if (level === 0) {
      positions.push({
        node: levelNodes[0],
        x: centerX,
        y: centerY
      });
      continue;
    }

    const radius = 110 + level * radiusStep;
    levelNodes.forEach((node, index) => {
      const angle = (Math.PI * 2 * index) / levelNodes.length - Math.PI / 2;
      positions.push({
        node,
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius
      });
    });
  }

  return positions;
}

function fillForType(type: KnowledgeNode["type"]) {
  switch (type) {
    case "topic":
      return "#1f5eff";
    case "process":
      return "#0f9d7a";
    case "example":
      return "#f08b24";
    case "person":
      return "#c03f5a";
    default:
      return "#304156";
  }
}

export function KnowledgeGraph({
  graph,
  selectedNodeId,
  isLoading,
  onNodeSelect,
  onNodeExpand
}: KnowledgeGraphProps) {
  const positionedNodes = useMemo(() => (graph ? layoutNodes(graph) : []), [graph]);
  const nodeById = useMemo(() => {
    return new Map(positionedNodes.map((entry) => [entry.node.id, entry]));
  }, [positionedNodes]);

  if (!graph) {
    return (
      <div className="graph-empty">
        <p>Submit a topic to generate the first answer and related bubbles.</p>
      </div>
    );
  }

  return (
    <div className="graph-shell">
      <svg viewBox={`0 0 ${graphWidth} ${graphHeight}`} className="graph-canvas" role="img" aria-label="Knowledge graph">
        {graph.edges.map((edge) => {
          const source = nodeById.get(edge.source);
          const target = nodeById.get(edge.target);

          if (!source || !target) {
            return null;
          }

          const midX = (source.x + target.x) / 2;
          const midY = (source.y + target.y) / 2;

          return (
            <g key={`${edge.source}-${edge.target}-${edge.label}`}>
              <line className="graph-edge" x1={source.x} y1={source.y} x2={target.x} y2={target.y} />
              <text className="graph-edge-label" x={midX} y={midY}>
                {edge.label}
              </text>
            </g>
          );
        })}

        {positionedNodes.map(({ node, x, y }) => {
          const selected = node.id === selectedNodeId;
          const radius = node.type === "topic" ? 46 : 34;

          return (
            <g key={node.id} transform={`translate(${x} ${y})`}>
              <circle
                className={selected ? "graph-node selected" : "graph-node"}
                cx={0}
                cy={0}
                r={radius}
                fill={fillForType(node.type)}
                onClick={() => onNodeSelect(node)}
              />
              <foreignObject x={-radius + 8} y={-18} width={radius * 2 - 16} height={40} pointerEvents="none">
                <div className="node-label">{node.label}</div>
              </foreignObject>
              <circle className="graph-expand" cx={radius - 2} cy={radius - 2} r={12} onClick={() => onNodeExpand(node)} />
              <text className="graph-expand-icon" x={radius - 2} y={radius + 2} onClick={() => onNodeExpand(node)}>
                +
              </text>
            </g>
          );
        })}
      </svg>

      <div className="graph-legend">
        <p>{isLoading ? "Loading more related knowledge..." : "Click a bubble to inspect it. Click + to expand it."}</p>
      </div>
    </div>
  );
}
