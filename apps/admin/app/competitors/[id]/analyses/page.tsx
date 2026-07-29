import { notFound } from "next/navigation";
import Link from "next/link";
import { getCompetitor, listAnalyses } from "@/lib/queries";
import { renderMarkdown } from "@/lib/markdown";
import { TabNav } from "@/components/tab-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { AnalysisGenerator } from "@/components/analysis-generator";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const FRAMEWORK_LABELS: Record<string, string> = {
  "brunson-funnel": "Brunson Funnel",
  "hormozi-grand-slam": "Hormozi Grand Slam",
  "dream-100": "Dream 100",
  "challenger-recommendation": "Challenger Recommendation",
};

export default async function CompetitorAnalysesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [competitor, analyses] = await Promise.all([
    getCompetitor(id),
    listAnalyses(id),
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
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b bg-background">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Competitors
          </Link>
          <span className="text-muted-foreground">/</span>
          <Link
            href={`/competitors/${id}`}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {competitor.name}
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-medium text-foreground">Analyses</span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            {competitor.name}
          </h1>
          {competitor.one_line_summary && (
            <p className="text-sm text-muted-foreground mt-1">
              {competitor.one_line_summary}
            </p>
          )}
        </div>

        <TabNav tabs={tabs} />

        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Generate analysis
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Run a framework against this competitor's full dossier. Results are saved below.
            </p>
          </div>
          <AnalysisGenerator competitorId={id} />
        </section>

        <Separator />

        <section className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-foreground">
              Saved analyses
            </h2>
            <span className="text-xs text-muted-foreground">
              {analyses.length} total
            </span>
          </div>

          {analyses.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  No analyses yet. Pick a framework above to generate the first one.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {analyses.map((a) => (
                <Card key={a.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-semibold text-foreground">
                            {FRAMEWORK_LABELS[a.framework] ?? a.framework}
                          </h3>
                          <Badge variant="secondary" className="text-[10px] font-mono">
                            {a.generated_by ?? "?"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(a.generated_at).toLocaleString()}
                        </p>
                      </div>
                      {a.scores && (
                        <div className="flex gap-2 flex-wrap justify-end">
                          {Object.entries(a.scores).map(([k, v]) => (
                            <Badge key={k} variant="outline" className="text-xs">
                              <span className="text-muted-foreground mr-1">{k}</span>
                              <span className="font-semibold text-foreground">{v}</span>
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Separator className="mb-4" />
                    {/* renderMarkdown sanitizes before this hits the DOM —
                        the Markdown is LLM-written from scraped pages, so it
                        is untrusted input. Never swap it back for marked. */}
                    <div
                      className="analysis-markdown"
                      dangerouslySetInnerHTML={{
                        __html: renderMarkdown(a.markdown),
                      }}
                    />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
