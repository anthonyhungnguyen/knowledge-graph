import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { exploreTopic } from "../lib/explore";
import type { GraphExpandMode } from "../lib/types";

type ExploreRouteRequest = {
  topic?: string;
  mode?: GraphExpandMode;
};

const app = express();
const port = Number(process.env.PORT ?? 3001);
const isApiOnly = process.argv.includes("--api-only");
const serverDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(serverDir, "..");
const distDir = path.join(rootDir, "dist");

app.use(express.json());

app.post("/api/explore", async (request, response) => {
  try {
    const body = request.body as ExploreRouteRequest;
    const topic = body.topic?.trim();
    const mode = body.mode === "deeper" ? "deeper" : "related";

    if (!topic) {
      response.status(400).json({ error: "Topic is required." });
      return;
    }

    const graph = await exploreTopic(topic, { mode });
    response.json(graph);
  } catch {
    response.status(500).json({ error: "Failed to explore topic." });
  }
});

if (!isApiOnly) {
  app.use(express.static(distDir));

  app.get("/{*path}", (_request, response) => {
    response.sendFile(path.join(distDir, "index.html"));
  });
}

app.listen(port, () => {
  console.log(
    isApiOnly
      ? `Explore API listening on http://localhost:${port}`
      : `App listening on http://localhost:${port}`
  );
});
