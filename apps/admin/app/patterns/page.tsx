import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { listCompetitors, getPatternsData } from "@/lib/queries";
import { SignOutButton } from "@/components/sign-out-button";
import { AdThumb } from "@/components/ad-thumb";
import type { Competitor } from "@/lib/queries";

const HOOK_TOOLTIPS: Record<string, string> = {
  "direct": "Direct response — states the offer immediately. Works for warm audiences.",
  "religious-curiosity": "Insider hook — devotional language for warm/believer traffic.",
  "emotional": "Emotion-first — leads with a feeling state for cold traffic.",
  "curiosity": "Curiosity gap — raises a question to draw the prospect in.",
  "authority-quote": "Social proof — teacher quote as the hook.",
  "identity": "Identity hook — org name + mission, targets hot traffic comparing options.",
  "tourism": "Tourism/place hook — retreat location as the draw.",
  "quiz": "Quiz/segmentation — routes prospects into the right program.",
};

const STRATEGY_TOOLTIPS: Record<string, string> = {
  "always-on": "Runs a small set of evergreen ads continuously, 365 days a year.",
  "event-funnel": "Builds a full paid-ad campaign around a single major event.",
  "event-pulse": "Short bursts of ad activity for each individual event.",
  "multi-brand": "Runs separate ads under multiple sub-brands to access different segments.",
  "course-finder": "Uses a quiz or segmentation tool as the front-end lead magnet.",
  "decentralized": "Different centres run their own ads independently with no global coordination.",
  "none": "No paid acquisition — relies entirely on organic reach.",
};

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

function hasPaidIntro(c: Competitor): boolean {
  const ladder = Array.isArray(c.value_ladder) ? c.value_ladder : [];
  const paidRungs = ladder.filter((r) => {
    const p = (r.price ?? "").toString().toLowerCase();
    return p && !p.includes("free") && !p.includes("donation");
  });
  if (!paidRungs.length) return false;
  const first = paidRungs[0];
  return !!first.type && (first.type.includes("intro") || first.type.includes("flagship"));
}

function hasEmailCapture(c: Competitor): boolean {
  const ladder = Array.isArray(c.value_ladder) ? c.value_ladder : [];
  return ladder.some(
    (r) =>
      (r.type && (r.type.includes("continuity") || r.type.includes("content"))) ||
      (r.offer || "").toLowerCase().includes("newsletter")
  );
}

function hasSecularFraming(c: Competitor): boolean {
  return ["secular-mystical", "warm-secular", "calm-secular-friendly"].includes(c.voice_descriptor ?? "");
}

function hasLivingCharacter(c: Competitor): boolean {
  return c.attractive_character_alive === true;
}

function Dot({ val }: { val: boolean | null }) {
  if (val === true)
    return (
      <span
        className="inline-block w-3 h-3 rounded-full"
        style={{ background: "#22c55e" }}
        title="Yes"
      />
    );
  if (val === false)
    return (
      <span
        className="inline-block w-3 h-3 rounded-full"
        style={{ background: "#374151" }}
        title="No"
      />
    );
  return (
    <span
      className="inline-block w-3 h-3 rounded-full"
      style={{ background: "#d97706" }}
      title="Partial"
    />
  );
}

// TODO(step 4/8): these are placeholders. Replace with a per-run synthesis
// generated from `analyses` (competitor_id IS NULL, framework =
// 'challenger-recommendation') once the run-scoped cross-competitor
// analysis lands — see the design doc in docs/.
const GAPS = [
  {
    label: "Evergreen winner gap",
    text: "Sample placeholder — run a benchmark to see which competitor holds the longest-running ad and what hook it uses.",
  },
  {
    label: "Lead magnet gap",
    text: "Sample placeholder — flags which competitors have a segmentation quiz or free intro offer, and which don't.",
  },
  {
    label: "Paid intro program",
    text: "Sample placeholder — flags whether any competitor charges for a front-end offer vs. free-only.",
  },
];

const TEMP_INSIGHTS = [
  {
    label: "Dominant temperature",
    text: "Sample placeholder — shows the cold/warm/hot split across the benchmarked ads.",
  },
  {
    label: "Cold traffic opportunity",
    text: "Sample placeholder — flags which hook angles are the only ones actually converting strangers, not just retargeting.",
  },
];

export default async function PatternsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [competitors, patterns] = await Promise.all([
    listCompetitors(),
    getPatternsData(),
  ]);

  const competitorMap = new Map(competitors.map((c) => [c.id, c.name]));

  const displayName = (id: string) => {
    const n = competitorMap.get(id) ?? id;
    return n
      .replace("Centro de Meditação Kadampa Deuachen", "Kadampa")
      .replace("Brahma Kumaris Portugal", "BK Portugal")
      .replace("The Art of Living Foundation", "Art of Living");
  };

  const intelRows = competitors.map((c) => ({
    id: c.id,
    name: displayName(c.id),
    paidIntro: hasPaidIntro(c),
    email: hasEmailCapture(c),
    secular: hasSecularFraming(c),
    livingChar: hasLivingCharacter(c),
    evergreen: c.evergreen_count ?? 0,
    adStrategy: c.ad_strategy ?? "—",
  }));

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
        <div className="flex items-center gap-4">
          <span className="text-xs" style={{ color: "var(--ink-3)" }}>{session.user?.email}</span>
          <SignOutButton />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-10">
        <div>
          <h1 className="text-xl font-semibold mb-1" style={{ color: "var(--ink)" }}>
            Cross-competitor patterns
          </h1>
          <p className="text-xs" style={{ color: "var(--ink-3)" }}>
            Hook angles, traffic temperatures, and strategies classified using Brunson's Hook/Story/Offer framework and traffic temperature ladder (cold → warm → hot → believer).
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
              Strategy = the overall architecture of how an org uses paid ads over time. Only 1 org (Kadampa) has an always-on strategy.
            </p>
            <BarChart
              entries={patterns.strategies_count.map((s) => ({ label: s.strategy, count: s.count }))}
              tooltips={STRATEGY_TOOLTIPS}
              fillColor="#10b981"
            />
          </div>
        </div>

        {/* Marketing intelligence section */}
        <div>
          <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--ink)" }}>
            Marketing intelligence
          </h2>
          <p className="text-xs mb-5" style={{ color: "var(--ink-3)" }}>
            Structured comparison of acquisition infrastructure across all orgs. Derived from value ladders, ad strategy, voice descriptor, and ad data using Brunson's Linchpin model and Hormozi's Value Equation.
          </p>

          {/* Acquisition infrastructure table */}
          <div className="rounded-xl border overflow-hidden mb-6" style={{ borderColor: "var(--border)" }}>
            <div className="px-5 py-3 border-b" style={{ background: "var(--bg-2)", borderColor: "var(--border)" }}>
              <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--ink-3)" }}>
                Acquisition infrastructure comparison
              </h3>
              <p className="text-xs mt-0.5" style={{ color: "var(--ink-3)" }}>
                Green = yes, grey = no, orange = partial. Hover column headers for definitions.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr
                    className="text-xs uppercase tracking-wider border-b"
                    style={{ background: "var(--bg-3)", borderColor: "var(--border)", color: "var(--ink-3)" }}
                  >
                    <th className="text-left px-4 py-3">Org</th>
                    <th className="text-center px-4 py-3" title="First paid offer is a low-ticket intro program">Paid intro</th>
                    <th className="text-center px-4 py-3" title="Has a newsletter or free lead magnet with email">Email capture</th>
                    <th className="text-center px-4 py-3" title="Non-religious front door for cold traffic">Secular framing</th>
                    <th className="text-center px-4 py-3" title="Org's brand is built around a living teacher">Living character</th>
                    <th className="text-center px-4 py-3" title="Ads running ≥100 days">Evergreen ads</th>
                    <th className="text-left px-4 py-3">Ad strategy</th>
                  </tr>
                </thead>
                <tbody>
                  {intelRows.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b last:border-0 hover:bg-[var(--bg-3)] transition-colors"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/competitors/${r.id}`}
                          className="text-sm hover:text-indigo-400 transition-colors"
                          style={{ color: "var(--ink)" }}
                        >
                          {r.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-center"><Dot val={r.paidIntro} /></td>
                      <td className="px-4 py-3 text-center"><Dot val={r.email} /></td>
                      <td className="px-4 py-3 text-center"><Dot val={r.secular} /></td>
                      <td className="px-4 py-3 text-center"><Dot val={r.livingChar} /></td>
                      <td className="px-4 py-3 text-center text-xs font-mono" style={{ color: r.evergreen > 0 ? "#86efac" : "var(--ink-3)" }}>
                        {r.evergreen || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="text-xs px-2 py-0.5 rounded"
                          style={{ background: "var(--bg-3)", color: "var(--ink-2)" }}
                          title={STRATEGY_TOOLTIPS[r.adStrategy] ?? ""}
                        >
                          {r.adStrategy}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom row: gaps + temp analysis */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Strategic gaps */}
            <div className="rounded-xl p-5 border" style={{ background: "var(--bg-2)", borderColor: "var(--border)" }}>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--ink-3)" }}>
                Strategic gaps and opportunities for AM
              </h3>
              <p className="text-xs mb-4" style={{ color: "var(--ink-3)" }}>
                Based on what's working across this competitor sample, filtered through Brunson's Linchpin model and Hormozi's Dream 100 distribution logic.
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
                Brunson's traffic ladder: cold (never heard of you) → warm (engaged before) → hot (comparing options) → believer (already in community). Most orgs advertise almost exclusively to warm/believer.
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
