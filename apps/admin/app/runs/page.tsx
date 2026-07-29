import Link from "next/link";
import { listRuns } from "@/lib/queries";
import { ThemeToggle } from "@/components/theme-toggle";

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

export default async function RunsPage() {
  const runs = await listRuns();

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <header
        className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b"
        style={{ background: "var(--bg)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-6">
          <span className="font-semibold text-sm" style={{ color: "var(--ink)" }}>
            biz-benchmark
          </span>
          <nav className="flex items-center gap-4">
            <Link
              href="/runs"
              className="text-xs font-medium"
              style={{ color: "var(--ink)" }}
            >
              Runs
            </Link>
            <Link
              href="/dashboard"
              className="text-xs font-medium transition-colors hover:text-white"
              style={{ color: "var(--ink-3)" }}
            >
              All competitors
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold" style={{ color: "var(--ink)" }}>
            Runs
            <span className="ml-2 text-sm font-normal" style={{ color: "var(--ink-3)" }}>
              {runs.length} total
            </span>
          </h2>
          <Link
            href="/runs/new"
            className="text-xs px-3 py-1.5 rounded border transition-colors"
            style={{
              background: "var(--ink)",
              color: "var(--bg)",
              borderColor: "var(--ink)",
            }}
          >
            + New benchmark
          </Link>
        </div>

        {runs.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--ink-3)" }}>
            No runs yet.{" "}
            <Link href="/runs/new" className="underline">
              Start one
            </Link>
            .
          </p>
        ) : (
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
            {runs.map((run) => (
              <Link
                key={run.id}
                href={`/runs/${run.id}`}
                className="flex items-center justify-between px-5 py-4 border-b last:border-b-0 transition-colors hover:bg-[var(--bg-3)]"
                style={{ borderColor: "var(--border)", background: "var(--bg-2)" }}
              >
                <div>
                  <div className="text-sm font-medium" style={{ color: "var(--ink)" }}>
                    {run.niche_label}
                  </div>
                  <div className="text-xs" style={{ color: "var(--ink-3)" }}>
                    {run.country} · {new Date(run.created_at).toLocaleDateString()}
                  </div>
                </div>
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{
                    background: "var(--bg-3)",
                    color: STATUS_COLOR[run.status] ?? "var(--ink-3)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {run.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
