import Link from "next/link";
import type { Competitor, IntelSource } from "@/lib/queries";
import { OrgLogo } from "@/components/org-logo";
import { SocialPills } from "@/components/social-pills";

const STRATEGY_COLOR: Record<string, string> = {
  "always-on":     "#312e81",
  "event-funnel":  "#1e3a5f",
  "event-pulse":   "#1c3f2f",
  "multi-brand":   "#3b1f5e",
  "course-finder": "#4a1942",
  "decentralized": "#3d2400",
  "none":          "#1f2937",
};

const STRATEGY_TEXT: Record<string, string> = {
  "always-on":     "#a5b4fc",
  "event-funnel":  "#93c5fd",
  "event-pulse":   "#86efac",
  "multi-brand":   "#c4b5fd",
  "course-finder": "#f9a8d4",
  "decentralized": "#fcd34d",
  "none":          "#9ca3af",
};

interface CompetitorCardProps {
  competitor: Competitor;
  intelSources?: IntelSource[];
}

export function CompetitorCard({ competitor, intelSources = [] }: CompetitorCardProps) {
  const strategy = competitor.ad_strategy;
  const evergreenCount = competitor.evergreen_count ?? 0;
  const socialSources = intelSources.filter((s) =>
    ["instagram", "youtube_channel", "facebook", "tiktok", "linkedin_company"].includes(s.source_type),
  );

  return (
    <div
      className="rounded-xl border p-5 transition-colors group relative hover:border-indigo-500"
      style={{ background: "var(--bg-2)", borderColor: "var(--border)" }}
    >
      {/* Header row — logo + name + status */}
      <div className="flex items-start gap-3 mb-3">
        <OrgLogo
          name={competitor.name}
          siteUrl={competitor.primary_site_url}
          size="md"
        />
        <div className="flex-1 min-w-0">
          <Link
            href={`/competitors/${competitor.id}`}
            className="block group-hover:text-indigo-400 transition-colors"
          >
            <h2
              className="font-semibold text-base leading-snug"
              style={{ color: "var(--ink)" }}
            >
              {competitor.name}
            </h2>
          </Link>
        </div>
        <span
          className="text-xs px-2 py-0.5 rounded-full shrink-0"
          style={{
            background: competitor.status === "active" ? "#14532d" : "var(--bg-3)",
            color: competitor.status === "active" ? "#86efac" : "var(--ink-3)",
          }}
        >
          {competitor.status}
        </span>
      </div>

      {/* Badges row */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {competitor.hq_country && (
          <span
            className="text-xs px-2 py-0.5 rounded"
            style={{ background: "var(--bg-3)", color: "var(--ink-3)" }}
          >
            {competitor.hq_country}
          </span>
        )}
        {competitor.archetype && (
          <span
            className="text-xs px-2 py-0.5 rounded"
            style={{ background: "#1e2040", color: "#a5b4fc" }}
          >
            {competitor.archetype}
          </span>
        )}
        {strategy && strategy !== "none" && (
          <span
            className="text-xs px-2 py-0.5 rounded"
            style={{
              background: STRATEGY_COLOR[strategy] ?? "var(--bg-3)",
              color: STRATEGY_TEXT[strategy] ?? "var(--ink-2)",
            }}
          >
            {strategy}
          </span>
        )}
        {evergreenCount > 0 && (
          <span
            className="text-xs px-2 py-0.5 rounded"
            style={{ background: "#1c3a1c", color: "#86efac" }}
          >
            {evergreenCount} evergreen
          </span>
        )}
      </div>

      {/* One-liner — clickable through to detail page */}
      {competitor.one_line_summary && (
        <Link href={`/competitors/${competitor.id}`} className="block">
          <p className="text-xs mb-4 line-clamp-2" style={{ color: "var(--ink-2)" }}>
            {competitor.one_line_summary}
          </p>
        </Link>
      )}

      {/* Socials row */}
      {socialSources.length > 0 && (
        <div className="mb-4">
          <SocialPills sources={socialSources} variant="compact" />
        </div>
      )}

      {/* Stats row */}
      <Link
        href={`/competitors/${competitor.id}`}
        className="grid grid-cols-3 gap-2 pt-3 border-t hover:bg-[var(--bg-3)] -mx-5 px-5 -mb-5 pb-5 rounded-b-xl transition-colors"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="text-center">
          <div className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
            {competitor.ad_count ?? 0}
          </div>
          <div className="text-xs" style={{ color: "var(--ink-3)" }}>
            Total ads
          </div>
        </div>
        <div className="text-center">
          <div className="text-sm font-semibold" style={{ color: competitor.active_count ? "#86efac" : "var(--ink)" }}>
            {competitor.active_count ?? 0}
          </div>
          <div className="text-xs" style={{ color: "var(--ink-3)" }}>
            Active
          </div>
        </div>
        <div className="text-center">
          <div className="text-sm font-semibold" style={{ color: competitor.longest_run_days && competitor.longest_run_days >= 100 ? "#86efac" : "var(--ink)" }}>
            {competitor.longest_run_days ? `${competitor.longest_run_days}d` : "—"}
          </div>
          <div className="text-xs" style={{ color: "var(--ink-3)" }}>
            Longest run
          </div>
        </div>
      </Link>
    </div>
  );
}
