"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { createCompetitor } from "@/lib/queries";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function addCompetitorAction(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const name = String(formData.get("name") ?? "").trim();
  const pageHandle = String(formData.get("pageHandle") ?? "").trim() || name;
  const primarySiteUrl = String(formData.get("primary_site_url") ?? "").trim() || null;
  const hqCountry = String(formData.get("hq_country") ?? "PT").trim() || null;
  const orgType = String(formData.get("org_type") ?? "").trim() || null;
  const oneLineSummary = String(formData.get("one_line_summary") ?? "").trim() || null;
  const country = String(formData.get("country") ?? "PT").trim() || "PT";

  if (!name) throw new Error("Name is required");

  const id = slugify(name);
  if (!id) throw new Error("Could not generate id from name");

  await createCompetitor({
    id,
    name,
    primary_site_url: primarySiteUrl,
    hq_country: hqCountry,
    org_type: orgType,
    one_line_summary: oneLineSummary,
  });

  const workerUrl = process.env.WORKER_URL;
  if (workerUrl) {
    fetch(`${workerUrl}/scrape`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-worker-secret": process.env.WORKER_SECRET ?? "",
      },
      body: JSON.stringify({ competitorId: id, pageHandle, country }),
    }).catch((err) => console.error("worker trigger failed:", err));
  }

  redirect(`/competitors/${id}`);
}
