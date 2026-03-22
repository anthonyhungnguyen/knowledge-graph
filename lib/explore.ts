import { buildMockGraph } from "./mock-graph";
import type { ExplorationGraph, GraphExpandMode, GraphNodeType, KnowledgeEdge, KnowledgeNode } from "./types";

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

function normalizeNode(
  node: RawExplorationGraph["nodes"][number],
  requestedRootId: string,
  requestedTopic: string,
  rootAliases: Set<string>
): KnowledgeNode {
  const normalizedId = slugify(node.id || node.label);
  const isRootNode = rootAliases.has(normalizedId);

  return {
    id: isRootNode ? requestedRootId : normalizedId,
    label: isRootNode ? requestedTopic : node.label.trim(),
    type: isRootNode ? "topic" : node.type,
    summary: node.summary.trim()
  };
}

function normalizeEdge(
  edge: RawExplorationGraph["edges"][number],
  requestedRootId: string,
  rootAliases: Set<string>
): KnowledgeEdge {
  const source = slugify(edge.source);
  const target = slugify(edge.target);

  return {
    source: rootAliases.has(source) ? requestedRootId : source,
    target: rootAliases.has(target) ? requestedRootId : target,
    label: edge.label.trim()
  };
}

function ensureGraphShape(raw: RawExplorationGraph, requestedTopic: string): ExplorationGraph {
  const topic = requestedTopic.trim() || raw.topic?.trim() || "Topic";
  const rootId = slugify(topic) || "topic";
  const rootAliases = new Set<string>([rootId]);
  const rawTopicId = slugify(raw.topic ?? "");

  if (rawTopicId) {
    rootAliases.add(rawTopicId);
  }

  const rootNode: KnowledgeNode = {
    id: rootId,
    label: topic,
    type: "topic",
    summary: raw.summary?.trim() || `${topic} is the main topic currently being explored.`
  };

  const nodes = new Map<string, KnowledgeNode>([[rootNode.id, rootNode]]);

  for (const node of raw.nodes ?? []) {
    const normalized = normalizeNode(node, rootId, topic, rootAliases);

    if (!normalized.label) {
      continue;
    }

    if (normalized.id === rootId) {
      nodes.set(rootId, {
        ...rootNode,
        summary: normalized.summary || rootNode.summary
      });
      continue;
    }

    nodes.set(normalized.id, normalized);
  }

  const edges = new Map<string, KnowledgeEdge>();

  for (const edge of raw.edges ?? []) {
    const normalized = normalizeEdge(edge, rootId, rootAliases);

    if (!nodes.has(normalized.source) || !nodes.has(normalized.target)) {
      continue;
    }

    edges.set(`${normalized.source}:${normalized.target}:${normalized.label}`, normalized);
  }

  if (edges.size === 0) {
    const fallback = buildMockGraph(requestedTopic, {
      notice: "Showing mock data because the AI response could not be converted into a connected graph."
    });
    return fallback;
  }

  const resolvedRootNode = nodes.get(rootId) ?? rootNode;

  return {
    rootId,
    topic,
    summary: resolvedRootNode.summary,
    nodes: [...nodes.values()],
    edges: [...edges.values()],
    source: "openai"
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

async function buildGraphWithOpenAI(topic: string, mode: GraphExpandMode): Promise<ExplorationGraph> {
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
                "You create concise topic maps. Return valid JSON with keys topic, summary, nodes, and edges. The root topic should also appear in nodes. Keep to 6 nodes maximum and make the graph easy to scan."
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Build a topic exploration graph for: ${topic}
Exploration mode: ${mode}

Requirements:
- summary: 2 to 3 sentences
- nodes: array of objects with id, label, type, summary
- edges: array of objects with source, target, label
- types allowed: topic, concept, process, person, example
- connect all nodes to the root or to one clear parent
- if mode is "related", prefer breadth and adjacent topics
- if mode is "deeper", prefer mechanisms, constraints, sub-processes, and expert-level follow-up nodes
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

export async function exploreTopic(topic: string, options?: { mode?: GraphExpandMode }): Promise<ExplorationGraph> {
  const cleanTopic = topic.trim();
  const mode = options?.mode ?? "related";

  if (!cleanTopic) {
    throw new Error("Topic is required.");
  }

  if (!process.env.OPENAI_API_KEY) {
    return buildMockGraph(cleanTopic, {
      mode,
      notice: "Showing mock data because OPENAI_API_KEY is not configured."
    });
  }

  try {
    return await buildGraphWithOpenAI(cleanTopic, mode);
  } catch (error) {
    console.error("Falling back to mock graph after exploration failed.", error);

    return buildMockGraph(cleanTopic, {
      mode,
      notice: "Showing mock data because live exploration failed. Check the server logs for details."
    });
  }
}
