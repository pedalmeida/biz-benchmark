import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generateAnalysis, type Framework } from "@/lib/claude";
import {
  getCompetitorAnalysisBundle,
  insertAnalysis,
} from "@/lib/queries";

export const maxDuration = 300; // Vercel: allow up to 5 min for the model call

const VALID_FRAMEWORKS: Framework[] = [
  "brunson-funnel",
  "hormozi-grand-slam",
  "dream-100",
  "challenger-recommendation",
];

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { competitor_id?: string; framework?: string };
  const { competitor_id, framework } = body;

  if (!competitor_id) {
    return NextResponse.json({ error: "competitor_id is required" }, { status: 400 });
  }
  if (!framework || !VALID_FRAMEWORKS.includes(framework as Framework)) {
    return NextResponse.json(
      { error: `framework must be one of ${VALID_FRAMEWORKS.join(", ")}` },
      { status: 400 },
    );
  }

  const bundle = await getCompetitorAnalysisBundle(competitor_id);
  if (!bundle) {
    return NextResponse.json({ error: "competitor not found" }, { status: 404 });
  }

  let result;
  try {
    result = await generateAnalysis(framework as Framework, bundle);
  } catch (err) {
    const message = err instanceof Error ? err.message : "analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const id = await insertAnalysis({
    competitor_id,
    framework,
    markdown: result.markdown,
    scores: result.scores,
    generated_by: result.model,
  });

  return NextResponse.json({
    id,
    framework,
    markdown: result.markdown,
    scores: result.scores,
    usage: result.usage,
  });
}
