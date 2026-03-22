import { NextResponse } from "next/server";
import { exploreTopic } from "@/lib/explore";

type ExploreRouteRequest = {
  topic?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ExploreRouteRequest;
    const topic = body.topic?.trim();

    if (!topic) {
      return NextResponse.json({ error: "Topic is required." }, { status: 400 });
    }

    const graph = await exploreTopic(topic);
    return NextResponse.json(graph);
  } catch {
    return NextResponse.json({ error: "Failed to explore topic." }, { status: 500 });
  }
}
