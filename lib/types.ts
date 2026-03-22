export type GraphNodeType = "topic" | "concept" | "process" | "person" | "example";

export type KnowledgeNode = {
  id: string;
  label: string;
  type: GraphNodeType;
  summary: string;
};

export type KnowledgeEdge = {
  source: string;
  target: string;
  label: string;
};

export type ExplorationGraph = {
  rootId: string;
  topic: string;
  summary: string;
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
};

export type ExploreRequest = {
  topic: string;
};
