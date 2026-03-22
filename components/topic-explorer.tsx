"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Group, Paper, SegmentedControl, Stack, Text, TextInput, Textarea, Title } from "@mantine/core";
import { KnowledgeGraph } from "./knowledge-graph";
import { filterGraphByType, getPathToNode, mergeGraph } from "../lib/graph";
import type { ExplorationGraph, ExploreRequest, GraphExpandMode, GraphNodeType, KnowledgeNode } from "../lib/types";

const DEFAULT_TOPIC = "Neural networks";
const WORKSPACE_STORAGE_KEY = "topic-research-workspace-v1";

type WorkspaceSnapshot = {
  topic: string;
  graph: ExplorationGraph | null;
  selectedNodeId: string | null;
  activeFilter: GraphNodeType | "all";
  recentNodeIds: string[];
  notesByNodeId: Record<string, string>;
};

async function requestExploration(topic: string, signal: AbortSignal, mode: GraphExpandMode) {
  const response = await fetch("/api/explore", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ topic, mode } satisfies ExploreRequest),
    signal
  });

  if (!response.ok) {
    throw new Error("Unable to explore the requested topic.");
  }

  return (await response.json()) as ExplorationGraph;
}

function normalizeFilter(value: unknown): GraphNodeType | "all" {
  return value === "concept" || value === "process" || value === "example" || value === "person" || value === "topic" || value === "all"
    ? value
    : "all";
}

function buildWhyItMatters(node: KnowledgeNode | null, connectionCount: number, depth: number) {
  if (!node) {
    return "Select a node to see why it matters in this map.";
  }

  const role =
    node.type === "topic"
      ? "This is the framing node for the whole map."
      : node.type === "process"
        ? "This node explains how something works, changes, or unfolds."
        : node.type === "example"
          ? "This node grounds the map in a concrete case or application."
          : node.type === "person"
            ? "This node identifies a person whose work or decisions shape the topic."
            : "This node names a concept that helps organize the topic.";

  const adjacency = connectionCount === 0
    ? " It is currently isolated in view."
    : ` It connects to ${connectionCount} nearby ${connectionCount === 1 ? "node" : "nodes"}.`;
  const position = depth > 0 ? ` It sits ${depth} ${depth === 1 ? "step" : "steps"} from the root topic.` : "";

  return `${role}${adjacency}${position}`;
}

export function TopicExplorer() {
  const [topic, setTopic] = useState(DEFAULT_TOPIC);
  const [graph, setGraph] = useState<ExplorationGraph | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<GraphNodeType | "all">("all");
  const [recentNodeIds, setRecentNodeIds] = useState<string[]>([]);
  const [notesByNodeId, setNotesByNodeId] = useState<Record<string, string>>({});
  const activeRequestRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const workspaceReadyRef = useRef(false);

  const selectedNode: KnowledgeNode | null = graph
    ? graph.nodes.find((node) => node.id === (selectedNodeId ?? graph.rootId)) ?? null
    : null;

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    try {
      const rawSnapshot = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);

      if (!rawSnapshot) {
        workspaceReadyRef.current = true;
        return;
      }

      const snapshot = JSON.parse(rawSnapshot) as Partial<WorkspaceSnapshot>;

      if (typeof snapshot.topic === "string") {
        setTopic(snapshot.topic);
      }

      if (snapshot.graph) {
        setGraph(snapshot.graph);
      }

      if (typeof snapshot.selectedNodeId === "string" || snapshot.selectedNodeId === null) {
        setSelectedNodeId(snapshot.selectedNodeId ?? null);
      }

      setActiveFilter(normalizeFilter(snapshot.activeFilter));
      setRecentNodeIds(Array.isArray(snapshot.recentNodeIds) ? snapshot.recentNodeIds.filter((id): id is string => typeof id === "string") : []);

      if (snapshot.notesByNodeId && typeof snapshot.notesByNodeId === "object") {
        const nextNotes = Object.fromEntries(
          Object.entries(snapshot.notesByNodeId).filter((entry): entry is [string, string] => typeof entry[0] === "string" && typeof entry[1] === "string")
        );
        setNotesByNodeId(nextNotes);
      }
    } catch {
      window.localStorage.removeItem(WORKSPACE_STORAGE_KEY);
    } finally {
      workspaceReadyRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!workspaceReadyRef.current) {
      return;
    }

    const snapshot: WorkspaceSnapshot = {
      topic,
      graph,
      selectedNodeId,
      activeFilter,
      recentNodeIds,
      notesByNodeId
    };

    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(snapshot));
  }, [activeFilter, graph, notesByNodeId, recentNodeIds, selectedNodeId, topic]);

  const filteredGraph = useMemo(
    () => (graph ? filterGraphByType(graph, activeFilter, selectedNodeId) : null),
    [activeFilter, graph, selectedNodeId]
  );

  const selectedPath = useMemo(
    () => (graph && selectedNode ? getPathToNode(graph, selectedNode.id) : []),
    [graph, selectedNode]
  );

  const recentNodes = useMemo(
    () => (graph ? recentNodeIds.map((id) => graph.nodes.find((node) => node.id === id)).filter(Boolean) as KnowledgeNode[] : []),
    [graph, recentNodeIds]
  );

  const selectedConnections = useMemo(() => {
    if (!graph || !selectedNode) {
      return [];
    }

    const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
    const connections = new Map<string, { node: KnowledgeNode; label: string; direction: "incoming" | "outgoing" }>();

    for (const edge of graph.edges) {
      if (edge.source === selectedNode.id) {
        const relatedNode = nodeById.get(edge.target);

        if (relatedNode) {
          connections.set(`${relatedNode.id}:${edge.label}`, {
            node: relatedNode,
            label: edge.label,
            direction: "outgoing"
          });
        }
      }

      if (edge.target === selectedNode.id) {
        const relatedNode = nodeById.get(edge.source);

        if (relatedNode) {
          connections.set(`${relatedNode.id}:${edge.label}`, {
            node: relatedNode,
            label: edge.label,
            direction: "incoming"
          });
        }
      }
    }

    return [...connections.values()];
  }, [graph, selectedNode]);

  const selectedNote = selectedNode ? notesByNodeId[selectedNode.id] ?? "" : "";
  const whyItMatters = buildWhyItMatters(selectedNode, selectedConnections.length, Math.max(selectedPath.length - 1, 0));
  const nextDirections = selectedConnections.slice(0, 4);

  useEffect(() => {
    if (!selectedNode) {
      return;
    }

    setRecentNodeIds((current) => {
      const next = [selectedNode.id, ...current.filter((id) => id !== selectedNode.id)];
      return next.slice(0, 6);
    });
  }, [selectedNode]);

  async function runExploration(nextTopic: string, options?: { merge?: boolean; selectId?: string; mode?: GraphExpandMode }) {
    const cleanTopic = nextTopic.trim();

    if (!cleanTopic) {
      return;
    }

    setIsLoading(true);
    setError(null);

    abortControllerRef.current?.abort();

    const controller = new AbortController();
    const requestId = activeRequestRef.current + 1;
    const mode = options?.mode ?? "related";

    abortControllerRef.current = controller;
    activeRequestRef.current = requestId;

    try {
      const nextGraph = await requestExploration(cleanTopic, controller.signal, mode);

      if (activeRequestRef.current !== requestId) {
        return;
      }

      setGraph((current) => (options?.merge && current ? mergeGraph(current, nextGraph) : nextGraph));
      setSelectedNodeId(options?.selectId ?? nextGraph.rootId);
    } catch (requestError) {
      if (controller.signal.aborted) {
        return;
      }

      if (activeRequestRef.current !== requestId) {
        return;
      }

      setError(requestError instanceof Error ? requestError.message : "Something went wrong.");
    } finally {
      if (activeRequestRef.current === requestId) {
        setIsLoading(false);
      }

      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runExploration(topic);
  }

  function handleNodeSelect(node: KnowledgeNode) {
    setSelectedNodeId(node.id);
  }

  function handleNodeExpand(node: KnowledgeNode, mode: GraphExpandMode) {
    void runExploration(node.label, { merge: true, selectId: node.id, mode });
  }

  function handleResetToRoot() {
    if (!graph) {
      return;
    }

    setSelectedNodeId(graph.rootId);
    setTopic(graph.topic);
  }

  function handleClearWorkspace() {
    abortControllerRef.current?.abort();
    setTopic(DEFAULT_TOPIC);
    setGraph(null);
    setSelectedNodeId(null);
    setIsLoading(false);
    setError(null);
    setActiveFilter("all");
    setRecentNodeIds([]);
    setNotesByNodeId({});
    window.localStorage.removeItem(WORKSPACE_STORAGE_KEY);
  }

  function handleNoteChange(nextValue: string) {
    if (!selectedNode) {
      return;
    }

    setNotesByNodeId((current) => ({
      ...current,
      [selectedNode.id]: nextValue
    }));
  }

  const sourceColor = graph?.source === "openai" ? "blue" : graph?.source === "mixed" ? "grape" : "orange";
  const sourceLabel = graph?.source === "openai" ? "Live source" : graph?.source === "mixed" ? "Mixed source" : "Mock source";
  const selectedType = selectedNode ? selectedNode.type.charAt(0).toUpperCase() + selectedNode.type.slice(1) : "Topic";
  const hasGraph = Boolean(graph);
  const visibleNodeCount = filteredGraph?.nodes.length ?? 0;
  const totalNodeCount = graph?.nodes.length ?? 0;
  const visibleEdgeCount = filteredGraph?.edges.length ?? 0;
  const totalEdgeCount = graph?.edges.length ?? 0;
  const filterOptions = [
    { label: "All", value: "all" },
    { label: "Concepts", value: "concept" },
    { label: "Processes", value: "process" },
    { label: "Examples", value: "example" },
    { label: "People", value: "person" }
  ];

  return (
    <main className="explorer-shell">
      <div className="explorer-layout">
        <aside className="explorer-sidebar">
          <Paper className="sidebar-card sidebar-hero" radius="lg" p="lg" withBorder>
            <Stack gap="lg">
              <Group justify="space-between" align="flex-start">
                <Stack gap={6}>
                  <Text className="eyebrow-label">
                    Research map
                  </Text>
                  <Title order={1} className="sidebar-title">
                    Trace a topic.
                  </Title>
                  <Text size="sm" c="dimmed" maw={340}>
                    Build a working map of concepts, processes, examples, and people around one research question.
                  </Text>
                </Stack>
                {graph ? <Text className={`source-note source-${sourceColor}`}>{sourceLabel}</Text> : null}
              </Group>

              <form onSubmit={handleSubmit}>
                <Stack gap="sm">
                  <TextInput
                    id="topic-input"
                    name="topic"
                    aria-label="Search topic"
                    label="Query"
                    value={topic}
                    onChange={(event) => setTopic(event.currentTarget.value)}
                    placeholder="Enter a topic or question"
                    size="md"
                    radius="md"
                  />
                  <Button type="submit" loading={isLoading} radius="md" size="md" variant="filled">
                    Run query
                  </Button>
                </Stack>
              </form>

              <Group justify="space-between" align="center">
                <Text size="xs" c="dimmed">
                  Workspace saves locally, including notes and graph state.
                </Text>
                <Button type="button" variant="subtle" size="compact-sm" radius="md" onClick={handleClearWorkspace}>
                  Clear
                </Button>
              </Group>

              {error ? (
                <Alert color="red" radius="md" variant="light" title="Exploration failed">
                  {error}
                </Alert>
              ) : graph?.notice ? (
                <Alert color="yellow" radius="md" variant="light" title="Notice">
                  {graph.notice}
                </Alert>
              ) : null}
            </Stack>
          </Paper>

          <Paper className="sidebar-card" radius="lg" p="md" withBorder>
            <Stack gap="sm">
              <Text size="xs" tt="uppercase" c="dimmed" fw={700} className="section-label">
                Scope
              </Text>
              <SegmentedControl
                fullWidth
                radius="md"
                size="sm"
                value={activeFilter}
                onChange={(value) => setActiveFilter(value as GraphNodeType | "all")}
                data={filterOptions}
              />
            </Stack>
          </Paper>

          <Paper className="sidebar-card sidebar-stats" radius="lg" p="md" withBorder>
            <div>
              <Text size="xs" tt="uppercase" c="dimmed" fw={700} className="section-label">
                Nodes
              </Text>
              <Text size="lg" fw={700}>
                {visibleNodeCount}
                {hasGraph && visibleNodeCount !== totalNodeCount ? (
                  <Text span size="sm" c="dimmed" ml={6}>
                    / {totalNodeCount}
                  </Text>
                ) : null}
              </Text>
            </div>
            <div>
              <Text size="xs" tt="uppercase" c="dimmed" fw={700} className="section-label">
                Links
              </Text>
              <Text size="lg" fw={700}>
                {visibleEdgeCount}
                {hasGraph && visibleEdgeCount !== totalEdgeCount ? (
                  <Text span size="sm" c="dimmed" ml={6}>
                    / {totalEdgeCount}
                  </Text>
                ) : null}
              </Text>
            </div>
            <div>
              <Text size="xs" tt="uppercase" c="dimmed" fw={700} className="section-label">
                Focus
              </Text>
              <Text size="lg" fw={700}>
                {selectedType}
              </Text>
            </div>
          </Paper>

          {recentNodes.length > 0 ? (
            <Paper className="sidebar-card" radius="lg" p="md" withBorder>
              <Stack gap="sm">
                <Text size="xs" tt="uppercase" c="dimmed" fw={700} className="section-label">
                  Trail
                </Text>
                <div className="history-list">
                  {recentNodes.map((node) => (
                    <button
                      key={node.id}
                      type="button"
                      className={`history-chip${node.id === selectedNode?.id ? " is-active" : ""}`}
                      onClick={() => handleNodeSelect(node)}
                    >
                      {node.label}
                    </button>
                  ))}
                </div>
              </Stack>
            </Paper>
          ) : null}

          <Paper className="sidebar-card sidebar-inspector" radius="lg" p="lg" withBorder>
            <Stack gap="md">
              <div>
                <Text size="xs" tt="uppercase" c="dimmed" fw={700} className="section-label">
                  {selectedType}
                </Text>
                {selectedPath.length > 1 ? (
                  <Text size="xs" c="dimmed" mt={4}>
                    {selectedPath.map((node) => node.label).join(" / ")}
                  </Text>
                ) : null}
              </div>

              <div>
                <Title order={2}>{selectedNode?.label ?? "Select a node"}</Title>
                <Text size="sm" c="dimmed" mt="xs">
                  {selectedNode ? "Use this card as your working note for the selected node." : "Search for a topic, then click a node to inspect it here."}
                </Text>
              </div>

              <div className="research-section">
                <Text size="xs" tt="uppercase" c="dimmed" fw={700} className="section-label">
                  Summary
                </Text>
                <Text size="sm" mt="xs">
                  {selectedNode?.summary ?? "No summary available yet."}
                </Text>
              </div>

              <div className="research-section">
                <Text size="xs" tt="uppercase" c="dimmed" fw={700} className="section-label">
                  Why it matters
                </Text>
                <Text size="sm" c="dimmed" mt="xs">
                  {whyItMatters}
                </Text>
              </div>

              <div className="research-section">
                <Text size="xs" tt="uppercase" c="dimmed" fw={700} className="section-label">
                  Nearby
                </Text>
                {nextDirections.length > 0 ? (
                  <div className="connection-list">
                    {nextDirections.map((connection) => (
                      <button
                        key={`${connection.node.id}-${connection.label}`}
                        type="button"
                        className="connection-chip"
                        onClick={() => handleNodeSelect(connection.node)}
                      >
                        <span>{connection.node.label}</span>
                        <small>{connection.label}</small>
                      </button>
                    ))}
                  </div>
                ) : (
                  <Text size="sm" c="dimmed" mt="xs">
                    No nearby nodes are connected to the current selection yet.
                  </Text>
                )}
              </div>

              <div className="research-section">
                <Text size="xs" tt="uppercase" c="dimmed" fw={700} className="section-label">
                  Research notes
                </Text>
                <Textarea
                  mt="xs"
                  minRows={5}
                  autosize
                  radius="md"
                  value={selectedNote}
                  onChange={(event) => handleNoteChange(event.currentTarget.value)}
                  disabled={!selectedNode}
                  placeholder={selectedNode ? "Capture why this node matters, questions to follow up on, or evidence to verify." : "Select a node to start taking notes."}
                />
              </div>

              <Text size="sm" c="dimmed">
                High-frequency actions now appear next to the selected node on the map.
              </Text>

              <Button type="button" variant="default" radius="md" disabled={!graph} onClick={handleResetToRoot}>
                Return to root
              </Button>
            </Stack>
          </Paper>
        </aside>

        <section className="explorer-main">
          <div className="stage-header">
            <div>
              <Text size="xs" tt="uppercase" c="dimmed" fw={700} className="section-label">
                Working map
              </Text>
              <Title order={3}>{graph?.topic ?? "Knowledge graph"}</Title>
            </div>
            <Text size="sm" c="dimmed" maw={360} ta="right">
              Select a node to read its note. Use Related for lateral context and Deeper for mechanism.
            </Text>
          </div>

          <Paper className="stage-surface" radius="xl" withBorder>
            <KnowledgeGraph
              graph={filteredGraph}
              isLoading={isLoading}
              selectedNodeId={selectedNode?.id ?? null}
              selectedNodeLabel={selectedNode?.label ?? null}
              onNodeSelect={handleNodeSelect}
              onExpandRelated={() => {
                if (selectedNode) {
                  handleNodeExpand(selectedNode, "related");
                }
              }}
              onExpandDeeper={() => {
                if (selectedNode) {
                  handleNodeExpand(selectedNode, "deeper");
                }
              }}
            />
          </Paper>
        </section>
      </div>
    </main>
  );
}
