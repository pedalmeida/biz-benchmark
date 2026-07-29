import { notFound } from "next/navigation";
import Link from "next/link";
import { getCompetitor, getCompetitorHookCounts, getCompetitorTempCounts, getTopAdsForCompetitor, listAnalyses, listIntelSources } from "@/lib/queries";
import { TabNav } from "@/components/tab-nav";
import { OverviewTab } from "./tabs/overview";
import { ScrapeTrigger } from "@/components/scrape-trigger";
import { ThemeToggle } from "@/components/theme-toggle";
import { OrgLogo } from "@/components/org-logo";

export default async function CompetitorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [competitor, hookCounts, tempCounts, topAds, analyses, intelSources] = await Promise.all([
    getCompetitor(id),
    getCompetitorHookCounts(id),
    getCompetitorTempCounts(id),
    getTopAdsForCompetitor(id, 8),
    listAnalyses(id),
    listIntelSources(id),
  ]);

  if (!competitor) notFound();

  const ladderLen = Array.isArray(competitor.value_ladder) ? competitor.value_ladder.length : 0;
  const tabs = [
    { label: "Overview", href: `/competitors/${id}` },
    { label: `Ads (${competitor.ad_count ?? 0})`, href: `/competitors/${id}/ads` },
    { label: `Value Ladder (${ladderLen})`, href: `/competitors/${id}/ladder` },
    { label: `Analyses (${analyses.length})`, href: `/competitors/${id}/analyses` },
  ];

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <header
        className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b"
        style={{ background: "var(--bg)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="text-sm transition-colors"
            style={{ color: "var(--ink-3)" }}
          >
            Competitors
          </Link>
          <span style={{ color: "var(--ink-3)" }}>/</span>
          <span className="text-sm" style={{ color: "var(--ink)" }}>
            {competitor.name}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4 min-w-0">
              <OrgLogo
                name={competitor.name}
                siteUrl={competitor.primary_site_url}
                size="lg"
              />
              <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h1 className="text-2xl font-semibold" style={{ color: "var(--ink)" }}>
                  {competitor.name}
                </h1>
                {competitor.ad_strategy && competitor.ad_strategy !== "none" && (
                  <span
                    className="text-xs px-2 py-0.5 rounded"
                    style={{ background: "var(--bg-3)", color: "var(--ink-2)", border: "1px solid var(--border)" }}
                  >
                    {competitor.ad_strategy}
                  </span>
                )}
                {(competitor.evergreen_count ?? 0) > 0 && (
                  <span
                    className="text-xs px-2 py-0.5 rounded"
                    style={{ background: "#1c3a1c", color: "#86efac" }}
                  >
                    {competitor.evergreen_count} evergreen
                  </span>
                )}
              </div>
              {competitor.one_line_summary && (
                <p className="text-sm" style={{ color: "var(--ink-2)" }}>
                  {competitor.one_line_summary}
                </p>
              )}
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <ScrapeTrigger competitorId={id} pageHandle={competitor.name} />
              {competitor.primary_site_url && (
                <a
                  href={competitor.primary_site_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-3 py-1.5 rounded border transition-colors"
                  style={{ borderColor: "var(--border)", color: "var(--ink-3)" }}
                >
                  Visit site ↗
                </a>
              )}
            </div>
          </div>
        </div>

        <TabNav tabs={tabs} />

        <div className="mt-6">
          <OverviewTab
            competitor={competitor}
            hookCounts={hookCounts}
            tempCounts={tempCounts}
            topAds={topAds}
            intelSources={intelSources}
          />
        </div>
      </main>
    </div>
  );
}
