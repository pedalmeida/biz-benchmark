import { notFound } from "next/navigation";
import Link from "next/link";
import { getRun, listRunCompetitors, listRejectedCandidates } from "@/lib/queries";
import { CompetitorCard } from "@/components/competitor-card";
import { RunProgress } from "@/components/run-progress";

const VERDICT_LABEL: Record<string, string> = {
  rejected_gibberish: "Gibberish name",
  rejected_currency: "Currency mismatch",
  rejected_empty: "Empty creative",
  rejected_outlier: "Keyword-stuffing outlier",
  rejected_llm: "Off-niche",
  rejected_rank: "Below the cap",
};

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const run = await getRun(id);
  if (!run) notFound();

  const [competitors, rejected] = await Promise.all([
    listRunCompetitors(id),
    listRejectedCandidates(id),
  ]);

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <header
        className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b"
        style={{ background: "var(--bg)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-3">
          <Link href="/runs" className="text-sm" style={{ color: "var(--ink-3)" }}>
            Runs
          </Link>
          <span style={{ color: "var(--ink-3)" }}>/</span>
          <span className="text-sm" style={{ color: "var(--ink)" }}>
            {run.niche_label}
          </span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold mb-1" style={{ color: "var(--ink)" }}>
            {run.niche_label}
            <span className="ml-2 text-sm font-normal" style={{ color: "var(--ink-3)" }}>
              {run.country}
            </span>
          </h1>
          {run.keywords && run.keywords.length > 0 && (
            <p className="text-xs mb-4" style={{ color: "var(--ink-3)" }}>
              Searched: {run.keywords.join(" · ")}
            </p>
          )}
          <RunProgress runId={run.id} initialRun={run} />
        </div>

        <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--ink)" }}>
          Competitors
          <span className="ml-2 text-sm font-normal" style={{ color: "var(--ink-3)" }}>
            {competitors.length} included
          </span>
        </h2>

        {competitors.length === 0 ? (
          <p className="text-sm mb-8" style={{ color: "var(--ink-3)" }}>
            {run.status === "failed"
              ? "This run failed before it could collect competitors — see the error above. Nothing here is a finding about this market."
              : run.status === "ready" || run.status === "no_competitors_found"
                ? "No competitors survived the filter for this niche/country."
                : "Still discovering — competitors will appear here as they're found."}
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {competitors.map((c) => (
              <CompetitorCard key={c.id} competitor={c} />
            ))}
          </div>
        )}

        {rejected.length > 0 && (
          <details className="rounded-xl border" style={{ borderColor: "var(--border)" }}>
            <summary
              className="px-5 py-3 text-sm cursor-pointer select-none"
              style={{ color: "var(--ink-3)" }}
            >
              Filtered out ({rejected.length})
            </summary>
            <div className="px-5 pb-4">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ color: "var(--ink-3)" }}>
                    <th className="text-left font-normal py-2">Page</th>
                    <th className="text-left font-normal py-2">Ads seen</th>
                    <th className="text-left font-normal py-2">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {rejected.map((r) => (
                    <tr key={r.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                      <td className="py-2" style={{ color: "var(--ink)" }}>
                        {r.page_name}
                      </td>
                      <td className="py-2" style={{ color: "var(--ink-2)" }}>
                        {r.ad_count}
                      </td>
                      <td className="py-2" style={{ color: "var(--ink-2)" }}>
                        {VERDICT_LABEL[r.verdict] ?? r.verdict}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </main>
    </div>
  );
}
