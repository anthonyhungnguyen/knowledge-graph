"use client";

import { useState } from "react";
import { KnowledgeGraph } from "@/components/knowledge-graph";
import { mergeGraph } from "@/lib/graph";
import type { ExplorationGraph, ExploreRequest, KnowledgeNode } from "@/lib/types";

async function requestExploration(topic: string) {
  const response = await fetch("/api/explore", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ topic } satisfies ExploreRequest)
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

  const selectedNode: KnowledgeNode | null = graph
    ? graph.nodes.find((node) => node.id === (selectedNodeId ?? graph.rootId)) ?? null
    : null;

  async function runExploration(nextTopic: string, options?: { merge?: boolean; selectId?: string }) {
    const cleanTopic = nextTopic.trim();

    if (!cleanTopic) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const nextGraph = await requestExploration(cleanTopic);

      setGraph((current) => (options?.merge && current ? mergeGraph(current, nextGraph) : nextGraph));
      setSelectedNodeId(options?.selectId ?? nextGraph.rootId);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runExploration(topic);
  }

  function handleNodeSelect(node: KnowledgeNode) {
    setSelectedNodeId(node.id);
  }

  function handleNodeExpand(node: KnowledgeNode) {
    void runExploration(node.label, { merge: true, selectId: node.id });
  }

  return (
    <main className="page-shell">
      <section className="hero-card">
        <div className="hero-copy">
          <p className="eyebrow">Topic Knowledge Explorer</p>
          <h1>Turn one topic into an answer and an expandable map.</h1>
          <p className="hero-text">
            Enter a starting concept, generate a concise explanation, and click connected bubbles to drill into the surrounding knowledge space.
          </p>
        </div>

        <form className="topic-form" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="topic-input">
            Enter a topic
          </label>
          <input
            id="topic-input"
            name="topic"
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            placeholder="Enter a topic like quantum computing"
          />
          <button type="submit" disabled={isLoading}>
            {isLoading ? "Exploring..." : "Explore"}
          </button>
        </form>

        <p className="helper-text">
          The API currently returns deterministic mock data unless `OPENAI_API_KEY` is configured.
        </p>
      </section>

      <section className="workspace-grid">
        <article className="panel answer-panel">
          <div className="panel-header">
            <p className="panel-kicker">Answer</p>
            <h2>{selectedNode?.label ?? "Start with a topic"}</h2>
          </div>

          {error ? <p className="error-text">{error}</p> : null}

          <p className="panel-body">
            {selectedNode?.summary ??
              "The selected topic summary will appear here. Submit a topic to seed the graph, then click bubbles to inspect connected ideas."}
          </p>

          {graph ? (
            <div className="summary-chip">
              <span>Main topic</span>
              <strong>{graph.topic}</strong>
            </div>
          ) : null}
        </article>

        <article className="panel graph-panel">
          <div className="panel-header">
            <p className="panel-kicker">Knowledge Graph</p>
            <h2>{graph ? "Click a node to inspect or expand it" : "Waiting for a starting topic"}</h2>
          </div>

          <KnowledgeGraph
            graph={graph}
            selectedNodeId={selectedNode?.id ?? null}
            isLoading={isLoading}
            onNodeSelect={handleNodeSelect}
            onNodeExpand={handleNodeExpand}
          />
        </article>
      </section>
    </main>
  );
}
