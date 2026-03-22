export type GraphNodeType = "topic" | "concept" | "process" | "person" | "example";
export type GraphExpandMode = "related" | "deeper";

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

export type GraphSource = "openai" | "mock" | "mixed";

export type ExplorationGraph = {
  rootId: string;
  topic: string;
  summary: string;
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  source: GraphSource;
  notice?: string;
};

export type ExploreRequest = {
  topic: string;
  mode?: GraphExpandMode;
};
