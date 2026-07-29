"use server";

import { redirect } from "next/navigation";

export async function createRunAction(formData: FormData) {
  const nicheLabel = String(formData.get("nicheLabel") ?? "").trim();
  const country = String(formData.get("country") ?? "PT").trim().toUpperCase() || "PT";

  if (!nicheLabel) throw new Error("Niche is required");

  const workerUrl = process.env.WORKER_URL;
  if (!workerUrl) throw new Error("WORKER_URL not configured");

  const res = await fetch(`${workerUrl}/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-worker-secret": process.env.WORKER_SECRET ?? "",
    },
    body: JSON.stringify({ nicheLabel, country }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Worker error");
  }

  const { runId } = (await res.json()) as { runId: string };
  redirect(`/runs/${runId}`);
}
