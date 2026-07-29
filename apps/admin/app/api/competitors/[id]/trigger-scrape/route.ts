import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { pageHandle, country } = body as { pageHandle: string; country?: string };

  if (!pageHandle?.trim()) {
    return NextResponse.json({ error: "pageHandle is required" }, { status: 400 });
  }

  const workerUrl = process.env.WORKER_URL;
  if (!workerUrl) {
    return NextResponse.json({ error: "WORKER_URL not configured" }, { status: 503 });
  }

  const res = await fetch(`${workerUrl}/scrape`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-worker-secret": process.env.WORKER_SECRET ?? "",
    },
    body: JSON.stringify({ competitorId: id, pageHandle, country: country ?? "PT" }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return NextResponse.json({ error: (err as { error?: string }).error ?? "Worker error" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
