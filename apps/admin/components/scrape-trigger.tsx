"use client";

import { useState, useEffect, useCallback } from "react";

type JobStatus = "queued" | "running" | "partial" | "ok" | "failed" | null;

type ScrapeJob = {
  id: number;
  status: JobStatus;
  started_at: string | null;
  finished_at: string | null;
  records_added: Record<string, number> | null;
  errors: Record<string, string> | null;
};

const STATUS_LABEL: Record<NonNullable<JobStatus>, string> = {
  queued: "Queued",
  running: "Running...",
  partial: "Partial",
  ok: "Done",
  failed: "Failed",
};

const STATUS_COLOR: Record<NonNullable<JobStatus>, string> = {
  queued: "#a3a3a3",
  running: "#fbbf24",
  partial: "#fb923c",
  ok: "#86efac",
  failed: "#f87171",
};

export function ScrapeTrigger({
  competitorId,
  pageHandle,
}: {
  competitorId: string;
  pageHandle: string;
}) {
  const [job, setJob] = useState<ScrapeJob | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/competitors/${competitorId}/scrape-status`);
      if (!res.ok) return;
      const data = await res.json();
      setJob(data);
    } catch {
      // ignore polling errors
    }
  }, [competitorId]);

  // Poll while a job is active
  useEffect(() => {
    fetchStatus();
    const active = job?.status === "queued" || job?.status === "running";
    if (!active) return;
    const timer = setInterval(fetchStatus, 3000);
    return () => clearInterval(timer);
  }, [fetchStatus, job?.status]);

  async function handleTrigger() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/competitors/${competitorId}/trigger-scrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageHandle, country: "PT" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body as { error?: string }).error ?? "Request failed");
        return;
      }
      // Start polling immediately
      await fetchStatus();
    } catch (e) {
      setError(String(e));
    } finally {
      setSending(false);
    }
  }

  const isActive = job?.status === "queued" || job?.status === "running";

  return (
    <div className="flex items-center gap-3">
      {job && (
        <span
          className="text-xs px-2 py-0.5 rounded"
          style={{
            background: "var(--bg-3)",
            color: STATUS_COLOR[job.status as NonNullable<JobStatus>] ?? "var(--ink-3)",
            border: "1px solid var(--border)",
          }}
        >
          {STATUS_LABEL[job.status as NonNullable<JobStatus>] ?? job.status}
          {job.status === "ok" && job.records_added?.meta_ad_library != null
            ? ` · ${job.records_added.meta_ad_library} ads`
            : ""}
        </span>
      )}
      {error && (
        <span className="text-xs" style={{ color: "#f87171" }}>
          {error}
        </span>
      )}
      <button
        onClick={handleTrigger}
        disabled={sending || isActive}
        className="text-xs px-3 py-1.5 rounded border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ borderColor: "var(--border)", color: "var(--ink-3)" }}
      >
        {sending || isActive ? "Refreshing..." : "Refresh ads"}
      </button>
    </div>
  );
}
