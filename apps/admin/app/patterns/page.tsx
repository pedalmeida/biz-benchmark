import Link from "next/link";
import { HOOK_ANGLES, AD_STRATEGIES } from "@radar/shared";
import { listCompetitors, getPatternsData } from "@/lib/queries";
import { AdThumb } from "@/components/ad-thumb";

const HOOK_TOOLTIPS: Record<string, string> = Object.fromEntries(
  HOOK_ANGLES.map((h) => [h.value, h.description])
);

const STRATEGY_TOOLTIPS: Record<string, string> = Object.fromEntries(
  AD_STRATEGIES.map((s) => [s.value, s.description])
);

function BarChart({
  entries,
  tooltips,
  fillColor = "#6366f1",
}: {
  entries: { label: string; count: number }[];
  tooltips?: Record<string, string>;
  fillColor?: string;
}) {
  const max = Math.max(1, ...entries.map((e) => e.count));
  const total = entries.reduce((s, e) => s + e.count, 0);

  if (entries.length === 0) {
    return <p className="text-xs" style={{ color: "var(--ink-3)" }}>No data.</p>;
  }

  return (
    <div className="space-y-2.5">
      {entries.map(({ label, count }) => (
        <div key={label} className="flex items-center gap-3">
          <span
            className="text-xs w-36 shrink-0 truncate"
            style={{ color: "var(--ink-2)" }}
            title={tooltips?.[label] ?? label}
          >
            {label}
          </span>
          <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: "var(--bg-3)" }}>
            <div
              className="h-full rounded-full"
              style={{ width: `${(count / max) * 100}%`, background: fillColor }}
            />
          </div>
          <span className="text-xs font-mono w-8 text-right" style={{ color: "var(--ink-3)" }}>
            {count}
          </span>
          <span className="text-xs w-8 text-right" style={{ color: "var(--ink-3)" }}>
            {Math.round((count / total) * 100)}%
          </span>
        </div>
      ))}
    </div>
  );
}

// TODO(step 4/8): these are placeholders. Replace with a per-run synthesis
// generated from `analyses` (competitor_id IS NULL, framework =
// 'challenger-recommendation') once the run-scoped cross-competitor
// analysis lands — see the design doc in docs/.
const GAPS = [
  {
    label: "Evergreen winner",
    text: "Coming soon — which competitor holds the longest-running ad in this sample, and what hook it uses.",
  },
  {
    label: "Lead magnet gap",
    text: "Coming soon — which competitors have a segmentation quiz or free intro offer, and which don't.",
  },
  {
    label: "Paid intro program",
    text: "Coming soon — whether any competitor charges for a front-end offer vs. free-only.",
  },
];

const TEMP_INSIGHTS = [
  {
    label: "Dominant temperature",
    text: "Coming soon — the cold/warm/hot split across this sample's ads.",
  },
  {
    label: "Cold traffic opportunity",
    text: "Coming soon — which hook angles are the only ones actually converting strangers, not just retargeting.",
  },
];

export default async function PatternsPage() {
  const [competitors, patterns] = await Promise.all([
    listCompetitors(),
    getPatternsData(),
  ]);

  const competitorMap = new Map(competitors.map((c) => [c.id, c.name]));

  const displayName = (id: string) => competitorMap.get(id) ?? id;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <header
        className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b"
        style={{ background: "var(--bg)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-sm" style={{ color: "var(--ink-3)" }}>
            Competitors
          </Link>
          <span style={{ color: "var(--ink-3)" }}>/</span>
          <span className="text-sm" style={{ color: "var(--ink)" }}>
            Patterns
          </span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-10">
        <div>
          <h1 className="text-xl font-semibold mb-1" style={{ color: "var(--ink)" }}>
            Cross-competitor patterns
          </h1>
          <p className="text-xs" style={{ color: "var(--ink-3)" }}>
            Hook angles, traffic temperatures, and strategies classified using Brunson's Hook/Story/Offer framework and traffic temperature ladder (cold → warm → hot).
          </p>
        </div>

        {/* Top row: charts */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Evergreen leaderboard */}
          <div className="rounded-xl p-5 border" style={{ background: "var(--bg-2)", borderColor: "var(--border)" }}>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--ink-3)" }}>
              Top 20 evergreen winners (≥100d)
            </h3>
            <p className="text-xs mb-4" style={{ color: "var(--ink-3)" }}>
              Ads running 100+ days signal proven messaging that survived market testing.
            </p>
            {patterns.evergreen_winners_top_20.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--ink-3)" }}>None.</p>
            ) : (
              <div className="space-y-2">
                {patterns.evergreen_winners_top_20.map((w, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <AdThumb
                      competitorId={w.competitor_id}
                      libraryId={w.library_id}
                      size="xs"
                      alt={w.headline ?? `Ad ${w.library_id}`}
                    />
                    <span
                      className="text-xs font-mono w-10 shrink-0 font-semibold pt-1"
                      style={{ color: w.duration_days >= 100 ? "#86efac" : "var(--ink-2)" }}
                    >
                      {w.duration_days}d
                    </span>
                    <div className="min-w-0">
                      <Link
                        href={`/competitors/${w.competitor_id}`}
                        className="text-xs font-medium hover:text-indigo-400 transition-colors"
                        style={{ color: "var(--ink-2)" }}
                      >
                        {displayName(w.competitor_id).slice(0, 18)}
                      </Link>
                      <p className="text-xs truncate" style={{ color: "var(--ink-3)" }} title={w.headline ?? undefined}>
                        {w.headline ?? "—"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Hook distribution */}
          <div className="rounded-xl p-5 border" style={{ background: "var(--bg-2)", borderColor: "var(--border)" }}>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--ink-3)" }}>
              Hook-angle distribution (all competitors)
            </h3>
            <p className="text-xs mb-4" style={{ color: "var(--ink-3)" }}>
              Hook = the first thing the audience sees. Direct dominates — most orgs speak to warm audiences who already know them.
            </p>
            <BarChart
              entries={patterns.hooks_global.map((h) => ({ label: h.angle, count: h.count }))}
              tooltips={HOOK_TOOLTIPS}
              fillColor="#6366f1"
            />
          </div>

          {/* Strategy breakdown */}
          <div className="rounded-xl p-5 border" style={{ background: "var(--bg-2)", borderColor: "var(--border)" }}>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--ink-3)" }}>
              Ad strategies in use
            </h3>
            <p className="text-xs mb-4" style={{ color: "var(--ink-3)" }}>
              Strategy = the overall architecture of how an org uses paid ads over time.
            </p>
            <BarChart
              entries={patterns.strategies_count.map((s) => ({ label: s.strategy, count: s.count }))}
              tooltips={STRATEGY_TOOLTIPS}
              fillColor="#10b981"
            />
          </div>
        </div>

        {/* Bottom row: gaps + temp analysis */}
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Strategic gaps */}
            <div className="rounded-xl p-5 border" style={{ background: "var(--bg-2)", borderColor: "var(--border)" }}>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--ink-3)" }}>
                Strategic gaps and opportunities
              </h3>
              <p className="text-xs mb-4" style={{ color: "var(--ink-3)" }}>
                Coming soon — a per-run synthesis across every competitor's data,
                filtered through Brunson's Linchpin model and Hormozi's Dream 100
                distribution logic. For now, generate a Challenger Recommendation
                analysis on any competitor's page for the same lens, one at a time.
              </p>
              <ul className="space-y-3">
                {GAPS.map((g) => (
                  <li key={g.label}>
                    <span
                      className="text-xs font-semibold block mb-0.5"
                      style={{ color: "var(--ink)" }}
                    >
                      {g.label}
                    </span>
                    <span className="text-xs" style={{ color: "var(--ink-3)" }}>
                      {g.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Traffic temperature analysis */}
            <div className="rounded-xl p-5 border" style={{ background: "var(--bg-2)", borderColor: "var(--border)" }}>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--ink-3)" }}>
                Traffic temperature analysis
              </h3>
              <p className="text-xs mb-4" style={{ color: "var(--ink-3)" }}>
                Brunson's traffic ladder: cold (never heard of you) → warm (engaged before) → hot (comparing options, close to buying). Coming soon — a real breakdown of this sample's cold/warm/hot split.
              </p>
              <ul className="space-y-3">
                {TEMP_INSIGHTS.map((t) => (
                  <li key={t.label}>
                    <span
                      className="text-xs font-semibold block mb-0.5"
                      style={{ color: "var(--ink)" }}
                    >
                      {t.label}
                    </span>
                    <span className="text-xs" style={{ color: "var(--ink-3)" }}>
                      {t.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
