"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

// Valid runs.status values: queued | discovering | classifying | scraping |
// funnels | ready | failed | no_competitors_found — kept as plain strings
// (not a union) since queries.ts already types the column as string.
type Run = {
  id: string;
  status: string;
  cost_cents: number;
  error: string | null;
};

const ACTIVE_STATUSES: string[] = ["queued", "discovering", "classifying", "scraping", "funnels"];

const STATUS_LABEL: Record<string, string> = {
  queued: "Queued",
  discovering: "Discovering competitors…",
  classifying: "Judging relevance / classifying ads…",
  scraping: "Scraping ad history…",
  funnels: "Crawling funnels…",
  ready: "Ready",
  failed: "Failed",
  no_competitors_found: "No competitors found",
};

const STATUS_COLOR: Record<string, string> = {
  queued: "#a3a3a3",
  discovering: "#fbbf24",
  classifying: "#fbbf24",
  scraping: "#fbbf24",
  funnels: "#fbbf24",
  ready: "#86efac",
  failed: "#f87171",
  no_competitors_found: "#fb923c",
};

export function RunProgress({ runId, initialRun }: { runId: string; initialRun: Run }) {
  const [run, setRun] = useState<Run>(initialRun);
  const router = useRouter();
  const wasActive = useRef(ACTIVE_STATUSES.includes(initialRun.status));

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/runs/${runId}/status`);
      if (!res.ok) return;
      const data = (await res.json()) as Run;
      setRun(data);
      // Transitioned from active to terminal — reload the server-rendered
      // competitor list and filtered-out panel below.
      if (wasActive.current && !ACTIVE_STATUSES.includes(data.status)) {
        router.refresh();
      }
      wasActive.current = ACTIVE_STATUSES.includes(data.status);
    } catch {
      // ignore polling errors, try again next tick
    }
  }, [runId, router]);

  useEffect(() => {
    if (!ACTIVE_STATUSES.includes(run.status)) return;
    const timer = setInterval(fetchStatus, 3000);
    return () => clearInterval(timer);
  }, [fetchStatus, run.status]);

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-lg border"
      style={{ background: "var(--bg-2)", borderColor: "var(--border)" }}
    >
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{
          background: STATUS_COLOR[run.status],
          animation: ACTIVE_STATUSES.includes(run.status) ? "pulse 1.5s infinite" : undefined,
        }}
      />
      <span className="text-sm" style={{ color: "var(--ink)" }}>
        {STATUS_LABEL[run.status] ?? run.status}
      </span>
      {run.error && (
        <span className="text-xs" style={{ color: "#f87171" }}>
          — {run.error}
        </span>
      )}
      <span className="text-xs ml-auto" style={{ color: "var(--ink-3)" }}>
        est. cost: {run.cost_cents}¢
      </span>
    </div>
  );
}
