import type { ExplorationGraph, GraphNodeType, KnowledgeNode } from "@/lib/types";

const relationTemplates = [
  { label: "core idea", type: "concept" as GraphNodeType },
  { label: "key part", type: "concept" as GraphNodeType },
  { label: "real-world use", type: "example" as GraphNodeType },
  { label: "common process", type: "process" as GraphNodeType },
  { label: "important question", type: "concept" as GraphNodeType },
  { label: "advanced topic", type: "concept" as GraphNodeType }
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

function buildChildNode(topic: string, template: (typeof relationTemplates)[number], index: number): KnowledgeNode {
  const label = `${titleCase(topic)} ${titleCase(template.label)} ${index + 1}`;

  return {
    id: slugify(label),
    label,
    type: template.type,
    summary: `${label} is one angle for understanding ${topic}. Expand it to explore more specific details.`
  };
}

export function buildMockGraph(rawTopic: string): ExplorationGraph {
  const topic = rawTopic.trim();
  const rootId = slugify(topic) || "topic";

  const rootNode: KnowledgeNode = {
    id: rootId,
    label: topic || "Untitled Topic",
    type: "topic",
    summary: `${topic || "This topic"} is the current center of exploration. The related bubbles show concepts, processes, and examples worth expanding.`
  };

  const nodes = [rootNode];
  const edges: ExplorationGraph["edges"] = [];

  relationTemplates.forEach((template, index) => {
    const child = buildChildNode(topic || "Topic", template, index);
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
    summary: `${topic || "This topic"} can be understood through its core ideas, major processes, practical examples, and deeper follow-up questions.`,
    nodes,
    edges
  };
}
