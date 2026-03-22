import type { ExplorationGraph, GraphExpandMode, GraphNodeType, KnowledgeNode } from "./types";

const relatedTemplates = [
  { label: "core idea", type: "concept" as GraphNodeType },
  { label: "key part", type: "concept" as GraphNodeType },
  { label: "real-world use", type: "example" as GraphNodeType },
  { label: "common process", type: "process" as GraphNodeType },
  { label: "important question", type: "concept" as GraphNodeType },
  { label: "advanced topic", type: "concept" as GraphNodeType }
];

const deeperTemplates = [
  { label: "underlying mechanism", type: "process" as GraphNodeType },
  { label: "key constraint", type: "concept" as GraphNodeType },
  { label: "notable example", type: "example" as GraphNodeType },
  { label: "expert perspective", type: "person" as GraphNodeType },
  { label: "failure mode", type: "concept" as GraphNodeType },
  { label: "next layer", type: "concept" as GraphNodeType }
];

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function titleCase(value: string) {
  return value
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildChildNode(topic: string, template: { label: string; type: GraphNodeType }, index: number, mode: GraphExpandMode): KnowledgeNode {
  const label = `${titleCase(topic)} ${titleCase(template.label)} ${index + 1}`;

  return {
    id: slugify(label),
    label,
    type: template.type,
    summary:
      mode === "deeper"
        ? `${label} goes one layer deeper into ${topic}. Use it to inspect mechanics, constraints, or expert-level detail.`
        : `${label} is one angle for understanding ${topic}. Expand it to explore more specific details.`
  };
}

export function buildMockGraph(rawTopic: string, options?: { notice?: string; mode?: GraphExpandMode }): ExplorationGraph {
  const topic = rawTopic.trim();
  const rootId = slugify(topic) || "topic";
  const mode = options?.mode ?? "related";
  const relationTemplates = mode === "deeper" ? deeperTemplates : relatedTemplates;

  const rootNode: KnowledgeNode = {
    id: rootId,
    label: topic || "Untitled Topic",
    type: "topic",
    summary:
      mode === "deeper"
        ? `${topic || "This topic"} is the current focus. The surrounding bubbles dig into mechanics, constraints, and deeper follow-up layers.`
        : `${topic || "This topic"} is the current center of exploration. The related bubbles show concepts, processes, and examples worth expanding.`
  };

  const nodes = [rootNode];
  const edges: ExplorationGraph["edges"] = [];

  relationTemplates.forEach((template, index) => {
    const child = buildChildNode(topic || "Topic", template, index, mode);
    nodes.push(child);
    edges.push({
      source: rootId,
      target: child.id,
      label: template.label
    });
  });

  return {
    rootId,
    topic: topic || "Untitled Topic",
    summary:
      mode === "deeper"
        ? `${topic || "This topic"} can be unpacked through mechanisms, constraints, deeper examples, and specialized follow-up questions.`
        : `${topic || "This topic"} can be understood through its core ideas, major processes, practical examples, and deeper follow-up questions.`,
    nodes,
    edges,
    source: "mock",
    notice: options?.notice
  };
}
