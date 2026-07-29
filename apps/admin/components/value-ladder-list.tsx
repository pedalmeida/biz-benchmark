"use client";

import { useState, useMemo } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { ValueLadderRung } from "@/lib/queries";

// Brunson rung-type primer — what each tier exists to do in the ladder.
const RUNG_TYPE_META: Record<
  string,
  { label: string; purpose: string; color: string }
> = {
  intro: {
    label: "Intro / Front Door",
    purpose:
      "Lowest-friction entry. Free or near-free. Job: get a stranger to raise their hand.",
    color: "#86efac",
  },
  "lead-magnet": {
    label: "Lead Magnet",
    purpose:
      "Free in exchange for an email. Should solve a specific, narrow problem so they trust you with bigger ones.",
    color: "#86efac",
  },
  tripwire: {
    label: "Tripwire",
    purpose:
      "Low-ticket paid offer (€1–€50). Job: convert a free subscriber into a buyer. Identity shift, not profit.",
    color: "#fbbf24",
  },
  core: {
    label: "Core Offer",
    purpose:
      "The main paid program. Where most revenue comes from. Job: deliver the promised transformation.",
    color: "#6366f1",
  },
  flagship: {
    label: "Flagship",
    purpose:
      "Premium positioning offer. High-ticket, high-touch. Job: anchor pricing and credentialise the brand.",
    color: "#a78bfa",
  },
  continuity: {
    label: "Continuity",
    purpose:
      "Recurring revenue (membership, subscription, certification track). Job: predictable cash flow + community lock-in.",
    color: "#f472b6",
  },
  retreat: {
    label: "Retreat / Immersion",
    purpose:
      "In-person, multi-day. Job: deepen commitment and create the strongest testimonials.",
    color: "#fb923c",
  },
  ttc: {
    label: "Teacher Training",
    purpose:
      "The 'become one of us' offer. Highest commitment. Job: produce evangelists who recruit the next cohort.",
    color: "#fb923c",
  },
  advanced: {
    label: "Advanced Track",
    purpose:
      "Deepening for existing students. Job: keep your best customers paying for years.",
    color: "#fb923c",
  },
};

function priceLabel(price: ValueLadderRung["price"]): string {
  if (price == null) return "—";
  if (typeof price === "number") return price === 0 ? "Free" : `€${price}`;
  const v = String(price).trim().toLowerCase();
  if (v === "free" || v === "0" || v === "€0") return "Free";
  return String(price);
}

function rungColor(rungType: string | undefined): string {
  if (!rungType) return "var(--ink-3)";
  return RUNG_TYPE_META[rungType.toLowerCase()]?.color ?? "var(--ink-3)";
}

interface ValueLadderListProps {
  ladder: ValueLadderRung[];
}

export function ValueLadderList({ ladder }: ValueLadderListProps) {
  // Default: all collapsed
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const allExpanded = expanded.size === ladder.length;

  const toggle = (i: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const expandAll = () => setExpanded(new Set(ladder.map((_, i) => i)));
  const collapseAll = () => setExpanded(new Set());

  // Unique rung types present in this ladder — for the contextual primer at the bottom.
  const presentTypes = useMemo(
    () =>
      Array.from(
        new Set(
          ladder
            .map((r) => r.type?.toLowerCase())
            .filter((t): t is string => Boolean(t) && t in RUNG_TYPE_META),
        ),
      ),
    [ladder],
  );

  return (
    <>
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--ink-3)" }}>
          The ladder ({ladder.length} {ladder.length === 1 ? "rung" : "rungs"})
        </h2>
        <button
          onClick={allExpanded ? collapseAll : expandAll}
          className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          {allExpanded ? "Collapse all" : "Expand all"}
        </button>
      </div>

      <ol className="space-y-2 relative">
        <span
          aria-hidden="true"
          className="absolute left-[31px] top-4 bottom-4 w-px"
          style={{ background: "var(--border)" }}
        />
        {ladder.map((rung, i) => {
          const typeKey = (rung.type ?? "").toLowerCase();
          const typeMeta = RUNG_TYPE_META[typeKey];
          const accent = rungColor(typeKey);
          const isOpen = expanded.has(i);

          return (
            <li
              key={i}
              className="relative rounded-xl border overflow-hidden"
              style={{
                background: "var(--bg-2)",
                borderColor: "var(--border)",
                borderLeftWidth: "3px",
                borderLeftColor: accent,
              }}
            >
              {/* Clickable header (always visible) */}
              <button
                onClick={() => toggle(i)}
                className="w-full text-left flex items-center gap-4 p-4 hover:bg-[var(--bg-3)] transition-colors"
                aria-expanded={isOpen}
              >
                {/* Step number badge */}
                <div
                  className="shrink-0 size-9 rounded-full flex items-center justify-center font-semibold text-sm relative z-10"
                  style={{
                    background: "var(--bg-3)",
                    color: accent,
                    border: `1.5px solid ${accent}`,
                  }}
                  aria-label={`Rung ${i + 1}`}
                >
                  {i + 1}
                </div>

                {/* Headline content */}
                <div className="flex-1 min-w-0">
                  <p className="text-base font-semibold break-words" style={{ color: "var(--ink)" }}>
                    {rung.offer}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    {typeMeta ? (
                      <span
                        className="text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded"
                        style={{
                          background: "var(--bg-3)",
                          color: accent,
                          border: `1px solid ${accent}40`,
                        }}
                      >
                        {typeMeta.label}
                      </span>
                    ) : rung.type ? (
                      <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--ink-3)" }}>
                        {rung.type}
                      </span>
                    ) : null}
                    {rung.rung && (
                      <span className="text-xs" style={{ color: "var(--ink-3)" }}>
                        Step {rung.rung}
                      </span>
                    )}
                  </div>
                </div>

                {/* Price */}
                <span
                  className="text-base font-semibold shrink-0 whitespace-nowrap"
                  style={{ color: priceLabel(rung.price) === "Free" ? "#86efac" : "var(--ink-2)" }}
                >
                  {priceLabel(rung.price)}
                </span>

                {/* Chevron */}
                <span className="shrink-0 ml-1" style={{ color: "var(--ink-3)" }}>
                  {isOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                </span>
              </button>

              {/* Expanded body */}
              {isOpen && (
                <div className="px-4 pb-4 pl-[72px]">
                  {rung.description && (
                    <p className="text-sm leading-relaxed" style={{ color: "var(--ink-2)" }}>
                      {rung.description}
                    </p>
                  )}
                  {typeMeta && (
                    <p className="text-xs mt-3 italic" style={{ color: "var(--ink-3)" }}>
                      Brunson context: {typeMeta.purpose}
                    </p>
                  )}
                  {rung.url && (
                    <a
                      href={rung.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-block text-xs mt-3 text-indigo-400 hover:text-indigo-300 transition-colors break-all"
                    >
                      {rung.url} ↗
                    </a>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {/* Brunson primer — only show types present in the ladder */}
      {presentTypes.length > 0 && (
        <section className="pt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--ink-3)" }}>
            Brunson primer — rungs in this ladder
          </h2>
          <p className="text-xs mb-4" style={{ color: "var(--ink-3)" }}>
            Each tier exists for a different job in the customer journey. A healthy ladder has every
            job represented. Missing tiers are where prospects fall through.
          </p>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {presentTypes.map((t) => {
              const meta = RUNG_TYPE_META[t]!;
              return (
                <div
                  key={t}
                  className="rounded-lg p-4 border"
                  style={{
                    background: "var(--bg-2)",
                    borderColor: "var(--border)",
                    borderLeftWidth: "2px",
                    borderLeftColor: meta.color,
                  }}
                >
                  <dt className="text-sm font-semibold" style={{ color: meta.color }}>
                    {meta.label}
                  </dt>
                  <dd className="text-xs mt-1" style={{ color: "var(--ink-2)" }}>
                    {meta.purpose}
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>
      )}
    </>
  );
}
