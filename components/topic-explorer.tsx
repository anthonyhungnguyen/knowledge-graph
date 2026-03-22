"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Badge, Button, Group, Paper, SegmentedControl, SimpleGrid, Stack, Text, TextInput, Title } from "@mantine/core";
import { KnowledgeGraph } from "@/components/knowledge-graph";
import { filterGraphByType, getPathToNode, mergeGraph } from "@/lib/graph";
import type { ExplorationGraph, ExploreRequest, GraphExpandMode, GraphNodeType, KnowledgeNode } from "@/lib/types";

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

export function TopicExplorer() {
  const [topic, setTopic] = useState("Neural networks");
  const [graph, setGraph] = useState<ExplorationGraph | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<GraphNodeType | "all">("all");
  const [recentNodeIds, setRecentNodeIds] = useState<string[]>([]);
  const activeRequestRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const selectedNode: KnowledgeNode | null = graph
    ? graph.nodes.find((node) => node.id === (selectedNodeId ?? graph.rootId)) ?? null
    : null;

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

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

  const sourceColor = graph?.source === "openai" ? "teal" : graph?.source === "mixed" ? "violet" : "orange";
  const sourceLabel = graph?.source === "openai" ? "Live graph" : graph?.source === "mixed" ? "Mixed graph" : "Mock graph";
  const selectedType = selectedNode ? selectedNode.type.charAt(0).toUpperCase() + selectedNode.type.slice(1) : "Topic";
  const filterOptions = [
    { label: "All", value: "all" },
    { label: "Concepts", value: "concept" },
    { label: "Processes", value: "process" },
    { label: "Examples", value: "example" },
    { label: "People", value: "person" }
  ];

  return (
    <main className="explorer-shell">
      <Paper className="explorer-toolbar" radius="md" shadow="xl" p="md" withBorder>
        <Stack gap="md">
          <Group justify="space-between" align="flex-start" gap="sm">
            <Stack gap={4}>
              <Badge variant="light" radius="sm" w="fit-content">
                Atlas
              </Badge>
              <Title order={2} className="toolbar-title">
                Explore a topic.
              </Title>
            </Stack>

            {graph ? (
              <Badge color={sourceColor} variant="dot" radius="sm">
                {sourceLabel}
              </Badge>
            ) : null}
          </Group>

          <form onSubmit={handleSubmit}>
            <Group align="end" wrap="nowrap">
              <TextInput
                className="toolbar-input"
                id="topic-input"
                name="topic"
                label="Search Topic"
                value={topic}
                onChange={(event) => setTopic(event.currentTarget.value)}
                placeholder="Enter a topic like quantum computing"
                size="md"
                radius="xl"
              />
              <Button type="submit" loading={isLoading} radius="xl" size="md" variant="gradient" gradient={{ from: "cyan", to: "blue", deg: 135 }}>
                Explore
              </Button>
            </Group>
          </form>

          {error ? (
              <Alert color="red" radius="lg" variant="light" title="Exploration failed">
                {error}
              </Alert>
            ) : (
              <Stack gap="xs">
                <Text size="sm" c={graph?.notice ? "yellow.8" : "dimmed"}>
                  {graph?.notice ?? "Select a node. Expand when needed."}
                </Text>
                <SegmentedControl
                  fullWidth
                  radius="xl"
                  size="sm"
                  value={activeFilter}
                  onChange={(value) => setActiveFilter(value as GraphNodeType | "all")}
                  data={filterOptions}
                />
                {recentNodes.length > 0 ? (
                  <Group gap="xs">
                    {recentNodes.map((node) => (
                      <Badge
                        key={node.id}
                        variant={node.id === selectedNode?.id ? "filled" : "light"}
                        radius="xl"
                        className="history-chip"
                        onClick={() => handleNodeSelect(node)}
                      >
                        {node.label}
                      </Badge>
                    ))}
                  </Group>
                ) : null}
              </Stack>
            )}
        </Stack>
      </Paper>

      <section className="graph-stage">
        <KnowledgeGraph
          graph={filteredGraph}
          selectedNodeId={selectedNode?.id ?? null}
          onNodeSelect={handleNodeSelect}
        />
      </section>

      <Paper className="graph-dock" radius="md" shadow="xl" p="md" withBorder>
        <SimpleGrid cols={3} spacing="md">
          <div>
            <Text size="xs" tt="uppercase" c="dimmed" fw={700}>
              Nodes
            </Text>
            <Text size="lg" fw={700}>
              {filteredGraph?.nodes.length ?? 0}
            </Text>
          </div>
          <div>
            <Text size="xs" tt="uppercase" c="dimmed" fw={700}>
              Links
            </Text>
            <Text size="lg" fw={700}>
              {filteredGraph?.edges.length ?? 0}
            </Text>
          </div>
          <div>
            <Text size="xs" tt="uppercase" c="dimmed" fw={700}>
              Focus
            </Text>
            <Text size="lg" fw={700}>
              {selectedType}
            </Text>
          </div>
        </SimpleGrid>
      </Paper>

      <Paper className="selected-card" radius="md" shadow="xl" p="lg" withBorder>
        <Stack gap="md">
          <Badge variant="light" radius="sm" w="fit-content" color="cyan">
            {graph ? graph.topic : "No topic"}
          </Badge>
          <Stack gap={4}>
            <Text size="xs" tt="uppercase" c="dimmed" fw={700}>
              {selectedType}
            </Text>
            {selectedPath.length > 1 ? (
              <Text size="xs" c="dimmed">
                {selectedPath.map((node) => node.label).join(" / ")}
              </Text>
            ) : null}
            <Title order={2}>{selectedNode?.label ?? "Fullscreen graph"}</Title>
          </Stack>
          <Text size="sm" c="dimmed">
            {selectedNode?.summary ??
              "Enter a topic to start."}
          </Text>
          <Group grow>
            <Button
              type="button"
              radius="xl"
              disabled={!selectedNode}
              loading={isLoading}
              variant="gradient"
              gradient={{ from: "cyan", to: "blue", deg: 135 }}
              onClick={() => {
                if (selectedNode) {
                  handleNodeExpand(selectedNode, "related");
                }
              }}
            >
              Related
            </Button>

            <Button
              type="button"
              radius="xl"
              disabled={!selectedNode}
              loading={isLoading}
              variant="light"
              onClick={() => {
                if (selectedNode) {
                  handleNodeExpand(selectedNode, "deeper");
                }
              }}
            >
              Deeper
            </Button>
          </Group>
          <Group grow>
            <Button type="button" variant="default" radius="xl" disabled={!graph} onClick={handleResetToRoot}>
              Reset Focus
            </Button>
          </Group>
        </Stack>
      </Paper>
    </main>
  );
}
