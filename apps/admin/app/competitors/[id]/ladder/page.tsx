import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getCompetitor,
  getTopAdsForCompetitor,
  listAnalyses,
  type ValueLadderRung,
} from "@/lib/queries";
import { TabNav } from "@/components/tab-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { AdThumb } from "@/components/ad-thumb";
import { ValueLadderList } from "@/components/value-ladder-list";

const FUNNEL_ARCHETYPE_META: Record<
  string,
  { label: string; description: string }
> = {
  "opt-in": {
    label: "Opt-In",
    description:
      "Cold ad → free lead magnet → email nurture → low-ticket offer → core. Email is the spine.",
  },
  webinar: {
    label: "Webinar",
    description:
      "Cold ad → registration page → live or evergreen webinar → pitch at the end → application/checkout. Long sell, high commitment.",
  },
  application: {
    label: "Application",
    description:
      "Cold ad → 'limited spots' application form → screening call → high-ticket close. Reverses authority dynamic.",
  },
  bridge: {
    label: "Bridge",
    description:
      "Cold ad → quiz or pre-frame → product reveal → buy. Routes cold traffic into segmented offers.",
  },
  continuity: {
    label: "Continuity",
    description:
      "Free or cheap entry → upsell into recurring (membership, subscription). The economics live in renewals.",
  },
  summit: {
    label: "Summit",
    description:
      "Free virtual summit / event → email list → pitch to attendees. List-building disguised as content.",
  },
  unknown: {
    label: "Unclassified",
    description: "No clear funnel archetype identified yet.",
  },
};

export default async function CompetitorLadderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [competitor, topAds, analyses] = await Promise.all([
    getCompetitor(id),
    getTopAdsForCompetitor(id, 6),
    listAnalyses(id),
  ]);
  if (!competitor) notFound();

  const ladder = (competitor.value_ladder ?? []) as ValueLadderRung[];
  const archetypeKey = competitor.funnel_archetype ?? "unknown";
  const archetype =
    FUNNEL_ARCHETYPE_META[archetypeKey] ?? FUNNEL_ARCHETYPE_META.unknown;

  const tabs = [
    { label: "Overview", href: `/competitors/${id}` },
    { label: `Ads (${competitor.ad_count ?? 0})`, href: `/competitors/${id}/ads` },
    { label: `Value Ladder (${ladder.length})`, href: `/competitors/${id}/ladder` },
    { label: `Analyses (${analyses.length})`, href: `/competitors/${id}/analyses` },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b bg-background">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Competitors
          </Link>
          <span className="text-muted-foreground">/</span>
          <Link href={`/competitors/${id}`} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            {competitor.name}
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-medium text-foreground">Value Ladder</span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{competitor.name}</h1>
          {competitor.one_line_summary && (
            <p className="text-sm text-muted-foreground mt-1">{competitor.one_line_summary}</p>
          )}
        </div>

        <TabNav tabs={tabs} />

        {/* Funnel archetype banner */}
        <section
          className="rounded-xl p-5 border"
          style={{ background: "var(--bg-2)", borderColor: "var(--border)" }}
        >
          <div className="flex items-start gap-4">
            <div className="shrink-0">
              <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--ink-3)" }}>
                Funnel archetype
              </p>
              <p className="text-lg font-semibold" style={{ color: "var(--ink)" }}>
                {archetype.label}
              </p>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm" style={{ color: "var(--ink-2)" }}>{archetype.description}</p>
              <p className="text-xs mt-2" style={{ color: "var(--ink-3)" }}>
                The ladder below should reinforce this archetype. Look for: a clear front door, a
                first paid step that&apos;s lower-friction than the next, and at least one continuity
                or recurring offer. Gaps between rungs are where prospects fall out.
              </p>
            </div>
          </div>
        </section>

        {/* Top creatives feeding the ladder */}
        {topAds.length > 0 && (
          <section>
            <div className="flex items-baseline justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--ink-3)" }}>
                  Top creatives feeding the ladder
                </h2>
                <p className="text-xs mt-0.5" style={{ color: "var(--ink-3)" }}>
                  Where their paid traffic actually enters this ladder. Click to inspect on Meta Ad Library.
                </p>
              </div>
              <Link
                href={`/competitors/${id}/ads`}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                See all ads →
              </Link>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {topAds.map((ad) => (
                <a
                  key={ad.id}
                  href={ad.ad_library_url ?? `/competitors/${id}/ads`}
                  target={ad.ad_library_url ? "_blank" : undefined}
                  rel={ad.ad_library_url ? "noopener noreferrer" : undefined}
                  title={
                    (ad.headline ?? `Ad ${ad.library_id}`) +
                    (ad.duration_days ? ` · ${ad.duration_days} days` : "") +
                    (ad.is_evergreen_winner ? " · evergreen" : "")
                  }
                  className="relative shrink-0"
                >
                  <AdThumb
                    competitorId={ad.competitor_id}
                    libraryId={ad.library_id}
                    size="lg"
                    alt={ad.headline ?? `Ad ${ad.library_id}`}
                  />
                  {ad.is_evergreen_winner && (
                    <span
                      className="absolute -top-1 -right-1 text-[9px] font-semibold px-1.5 py-0.5 rounded"
                      style={{ background: "#1c3a1c", color: "#86efac" }}
                    >
                      EVG
                    </span>
                  )}
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Ladder rungs (client component with expand/collapse) */}
        {ladder.length === 0 ? (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--ink-3)" }}>
              The ladder
            </h2>
            <div
              className="rounded-xl p-8 text-center border"
              style={{ background: "var(--bg-2)", borderColor: "var(--border)" }}
            >
              <p className="text-sm" style={{ color: "var(--ink-2)" }}>
                No value ladder mapped for this competitor yet.
              </p>
              <p className="text-xs mt-2" style={{ color: "var(--ink-3)" }}>
                Either no scrape has captured their offer stack, or the dossier hasn&apos;t been
                back-filled. Try generating a Brunson Funnel analysis to surface the ladder.
              </p>
            </div>
          </section>
        ) : (
          <section>
            <ValueLadderList ladder={ladder} />
          </section>
        )}
      </main>
    </div>
  );
}
