import { NextResponse } from "next/server";
import { exploreTopic } from "@/lib/explore";
import type { GraphExpandMode } from "@/lib/types";

type ExploreRouteRequest = {
  topic?: string;
  mode?: GraphExpandMode;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ExploreRouteRequest;
    const topic = body.topic?.trim();
    const mode = body.mode === "deeper" ? "deeper" : "related";

    if (!topic) {
      return NextResponse.json({ error: "Topic is required." }, { status: 400 });
    }

    const graph = await exploreTopic(topic, { mode });
    return NextResponse.json(graph);
  } catch {
    return NextResponse.json({ error: "Failed to explore topic." }, { status: 500 });
  }
}
