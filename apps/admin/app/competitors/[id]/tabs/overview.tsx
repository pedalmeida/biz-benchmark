import type { Competitor, HookCount, TempCount, Ad, IntelSource } from "@/lib/queries";
import { AdThumb } from "@/components/ad-thumb";
import { SocialPills } from "@/components/social-pills";

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

const TEMP_TOOLTIPS: Record<string, string> = {
  "cold": "Cold — never heard of this org. Needs pain/aspiration hooks + free offer.",
  "warm": "Warm — has engaged before. Can use brand name and specific offers.",
  "hot": "Hot — actively comparing options. Can go straight to the offer.",
  "believer": "Believer — existing community. Uses insider vocabulary, promotes events.",
};

interface OverviewTabProps {
  competitor: Competitor;
  hookCounts: HookCount[];
  tempCounts: TempCount[];
  topAds: Ad[];
  intelSources: IntelSource[];
}

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

  if (entries.length === 0) {
    return <p className="text-xs" style={{ color: "var(--ink-3)" }}>No data.</p>;
  }

  return (
    <div className="space-y-2">
      {entries.map(({ label, count }) => (
        <div key={label} className="flex items-center gap-3">
          <span
            className="text-xs w-32 shrink-0 truncate"
            style={{ color: "var(--ink-2)" }}
            title={tooltips?.[label] ?? label}
          >
            {label}
          </span>
          <div
            className="flex-1 h-2 rounded-full overflow-hidden"
            style={{ background: "var(--bg-3)" }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${(count / max) * 100}%`, background: fillColor }}
            />
          </div>
          <span className="text-xs font-mono w-5 text-right" style={{ color: "var(--ink-3)" }}>
            {count}
          </span>
        </div>
      ))}
    </div>
  );
}

export function OverviewTab({ competitor, hookCounts, tempCounts, topAds, intelSources }: OverviewTabProps) {
  const socialSources = intelSources.filter((s) =>
    ["instagram", "youtube_channel", "facebook", "tiktok", "linkedin_company"].includes(s.source_type),
  );

  return (
    <div className="space-y-8">
      {/* Socials */}
      {socialSources.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--ink-3)" }}>
            Socials
          </h3>
          <SocialPills sources={socialSources} variant="full" />
        </section>
      )}
      {/* Analytics panels — only show if there are ads */}
      {(competitor.ad_count ?? 0) > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Hook angles */}
          <div className="rounded-xl p-4 border" style={{ background: "var(--bg-2)", borderColor: "var(--border)" }}>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--ink-3)" }}>
              Hook angles used
            </h3>
            <BarChart
              entries={hookCounts.map((h) => ({ label: h.angle, count: h.count }))}
              tooltips={HOOK_TOOLTIPS}
              fillColor="#6366f1"
            />
          </div>

          {/* Traffic temperatures */}
          <div className="rounded-xl p-4 border" style={{ background: "var(--bg-2)", borderColor: "var(--border)" }}>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--ink-3)" }}>
              Traffic temperatures
            </h3>
            <BarChart
              entries={tempCounts.map((t) => ({ label: t.temperature, count: t.count }))}
              tooltips={TEMP_TOOLTIPS}
              fillColor="#10b981"
            />
          </div>

          {/* Activity snapshot */}
          <div className="rounded-xl p-4 border" style={{ background: "var(--bg-2)", borderColor: "var(--border)" }}>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--ink-3)" }}>
              Activity snapshot
            </h3>
            <dl className="space-y-3">
              {[
                ["Total ads", String(competitor.ad_count ?? 0)],
                ["Currently active", String(competitor.active_count ?? 0)],
                ["Evergreen (≥100d)", String(competitor.evergreen_count ?? 0)],
                ["Longest run", competitor.longest_run_days ? `${competitor.longest_run_days} days` : "—"],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between items-baseline">
                  <dt className="text-xs" style={{ color: "var(--ink-3)" }}>{label}</dt>
                  <dd className="text-sm font-semibold" style={{ color: "var(--ink)" }}>{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}

      {/* Top creatives strip */}
      {topAds.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--ink-3)" }}>
            Top creatives
            <span className="ml-2 text-xs font-normal normal-case" style={{ color: "var(--ink-3)", letterSpacing: 0 }}>
              evergreen winners and longest-running ads
            </span>
          </h3>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {topAds.map((ad) => (
              <a
                key={ad.id}
                href={ad.ad_library_url ?? `/competitors/${competitor.id}/ads`}
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

      {/* Positioning */}
      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--ink-3)" }}>
          Positioning
        </h3>
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            ["Archetype", competitor.archetype],
            ["Audience", competitor.audience_target],
            ["Voice", competitor.voice_descriptor],
            ["Ad Strategy", competitor.ad_strategy],
            ["Funnel Archetype", competitor.funnel_archetype],
            ["Org Type", competitor.org_type],
            ["Org Size", competitor.org_size_estimate],
            ["Country", competitor.hq_country ? (competitor.hq_city ? `${competitor.hq_country} · ${competitor.hq_city}` : competitor.hq_country) : null],
            ["Founder", competitor.founder ? `${competitor.founder}${competitor.founder_alive === true ? " (living)" : competitor.founder_alive === false ? " (deceased)" : ""}` : null],
            ["Attractive Character", competitor.attractive_character_name],
          ].map(([label, value]) =>
            value ? (
              <div key={label as string} className="rounded-lg p-3" style={{ background: "var(--bg-3)" }}>
                <dt className="text-xs mb-1" style={{ color: "var(--ink-3)" }}>{label}</dt>
                <dd className="text-sm font-medium" style={{ color: "var(--ink)" }}>{value}</dd>
              </div>
            ) : null
          )}
        </dl>

        {competitor.positioning_notes && (
          <div className="mt-3 p-4 rounded-lg" style={{ background: "var(--bg-3)" }}>
            <p className="text-xs mb-1" style={{ color: "var(--ink-3)" }}>Positioning notes</p>
            <p className="text-sm" style={{ color: "var(--ink-2)" }}>
              {competitor.positioning_notes}
            </p>
          </div>
        )}
      </section>

    </div>
  );
}
