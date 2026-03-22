import { buildMockGraph } from "@/lib/mock-graph";
import type { ExplorationGraph, GraphNodeType, KnowledgeEdge, KnowledgeNode } from "@/lib/types";

const openAiModel = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";

type RawExplorationGraph = {
  topic: string;
  summary: string;
  nodes: Array<{
    id: string;
    label: string;
    type: GraphNodeType;
    summary: string;
  }>;
  edges: Array<{
    source: string;
    target: string;
    label: string;
  }>;
};

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeNode(node: RawExplorationGraph["nodes"][number]): KnowledgeNode {
  return {
    id: slugify(node.id || node.label),
    label: node.label.trim(),
    type: node.type,
    summary: node.summary.trim()
  };
}

function normalizeEdge(edge: RawExplorationGraph["edges"][number]): KnowledgeEdge {
  return {
    source: slugify(edge.source),
    target: slugify(edge.target),
    label: edge.label.trim()
  };
}

function ensureGraphShape(raw: RawExplorationGraph, requestedTopic: string): ExplorationGraph {
  const topic = raw.topic?.trim() || requestedTopic;
  const rootId = slugify(topic) || "topic";
  const rootNode: KnowledgeNode = {
    id: rootId,
    label: topic,
    type: "topic",
    summary: raw.summary?.trim() || `${topic} is the main topic currently being explored.`
  };

  const nodes = new Map<string, KnowledgeNode>([[rootNode.id, rootNode]]);

  for (const node of raw.nodes ?? []) {
    const normalized = normalizeNode(node);

    if (!normalized.label) {
      continue;
    }

    nodes.set(normalized.id, normalized);
  }

  const edges = new Map<string, KnowledgeEdge>();

  for (const edge of raw.edges ?? []) {
    const normalized = normalizeEdge(edge);

    if (!nodes.has(normalized.source) || !nodes.has(normalized.target)) {
      continue;
    }

    edges.set(`${normalized.source}:${normalized.target}:${normalized.label}`, normalized);
  }

  if (edges.size === 0) {
    const fallback = buildMockGraph(requestedTopic);
    return fallback;
  }

  return {
    rootId,
    topic,
    summary: rootNode.summary,
    nodes: [...nodes.values()],
    edges: [...edges.values()]
  };
}

function extractTextPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const maybeText = (payload as { output_text?: unknown }).output_text;
  if (typeof maybeText === "string" && maybeText.trim()) {
    return maybeText;
  }

  const output = (payload as { output?: Array<{ content?: Array<{ text?: string }> }> }).output;
  const firstText = output?.flatMap((item) => item.content ?? []).find((item) => typeof item.text === "string")?.text;

  return typeof firstText === "string" && firstText.trim() ? firstText : null;
}

async function buildGraphWithOpenAI(topic: string): Promise<ExplorationGraph> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: openAiModel,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "You create concise topic maps. Return valid JSON with keys topic, summary, nodes, and edges. The root topic should also appear in nodes. Keep to 6 related nodes maximum."
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Build a topic exploration graph for: ${topic}

Requirements:
- summary: 2 to 3 sentences
- nodes: array of objects with id, label, type, summary
- edges: array of objects with source, target, label
- types allowed: topic, concept, process, person, example
- connect all nodes to the root or to one clear parent
- the root node id should be "${slugify(topic)}"
- output JSON only`
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as unknown;
  const textPayload = extractTextPayload(payload);

  if (!textPayload) {
    throw new Error("OpenAI response did not include a JSON payload.");
  }

  const parsed = JSON.parse(textPayload) as RawExplorationGraph;
  return ensureGraphShape(parsed, topic);
}

export async function exploreTopic(topic: string): Promise<ExplorationGraph> {
  const cleanTopic = topic.trim();

  if (!cleanTopic) {
    throw new Error("Topic is required.");
  }

  if (!process.env.OPENAI_API_KEY) {
    return buildMockGraph(cleanTopic);
  }

  try {
    return await buildGraphWithOpenAI(cleanTopic);
  } catch {
    return buildMockGraph(cleanTopic);
  }
}
