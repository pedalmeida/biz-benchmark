"use client";

import { useState, useMemo, useCallback } from "react";
import Fuse from "fuse.js";
import type { Ad } from "@/lib/queries";
import { AdThumb } from "@/components/ad-thumb";

type SortField = "duration_days" | "started_at" | "headline" | "competitor_id";
type SortDir = "asc" | "desc";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function fmtDate(d: string | null): string {
  if (!d) return "?";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  if (!m) return String(d);
  const day = parseInt(m[3], 10);
  const month = MONTHS[parseInt(m[2], 10) - 1];
  const year = m[1];
  return `${day} ${month} ${year}`;
}

interface AdsTableProps {
  ads: Ad[];
  competitorMap?: Map<string, string>;
  showCompetitorCol?: boolean;
}

export function AdsTable({ ads, competitorMap, showCompetitorCol = false }: AdsTableProps) {
  const [hookFilter, setHookFilter] = useState<string>("all");
  const [tempFilter, setTempFilter] = useState<string>("all");
  const [competitorFilter, setCompetitorFilter] = useState<string>("all");
  const [activeOnly, setActiveOnly] = useState(false);
  const [evergreenOnly, setEvergreenOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({ field: "duration_days", dir: "desc" });

  // Derive unique hook angles + temperatures from this ad set
  const hookAngles = useMemo(() => {
    const s = new Set(ads.map((a) => a.hook_angle).filter(Boolean) as string[]);
    return Array.from(s).sort();
  }, [ads]);

  const temperatures = useMemo(() => {
    const order = ["cold", "warm", "hot", "believer"];
    const s = new Set(ads.map((a) => a.traffic_temperature).filter(Boolean) as string[]);
    return order.filter((t) => s.has(t));
  }, [ads]);

  const competitors = useMemo(() => {
    if (!competitorMap) return [];
    const ids = new Set(ads.map((a) => a.competitor_id));
    return Array.from(ids)
      .map((id) => ({ id, name: competitorMap.get(id) ?? id }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [ads, competitorMap]);

  // Fuse index for fuzzy search
  const fuse = useMemo(() => new Fuse(ads, {
    keys: [
      { name: "headline", weight: 3 },
      { name: "body", weight: 1 },
      { name: "cta", weight: 2 },
      { name: "library_id", weight: 2 },
    ],
    threshold: 0.35,
    minMatchCharLength: 3,
  }), [ads]);

  const toggleSort = useCallback((field: SortField) => {
    setSort((prev) =>
      prev.field === field
        ? { field, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { field, dir: "desc" }
    );
  }, []);

  const filtered = useMemo(() => {
    let result: Ad[];

    if (search.length >= 3) {
      result = fuse.search(search).map((r) => r.item);
    } else {
      result = ads.slice();
    }

    if (hookFilter !== "all") result = result.filter((a) => a.hook_angle === hookFilter);
    if (tempFilter !== "all") result = result.filter((a) => a.traffic_temperature === tempFilter);
    if (competitorFilter !== "all") result = result.filter((a) => a.competitor_id === competitorFilter);
    if (activeOnly) result = result.filter((a) => a.is_active);
    if (evergreenOnly) result = result.filter((a) => a.is_evergreen_winner);

    // Sort (skip if fuse already ranked results and no sort change)
    result = result.slice().sort((a, b) => {
      const dir = sort.dir === "asc" ? 1 : -1;
      const va = a[sort.field as keyof Ad];
      const vb = b[sort.field as keyof Ad];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "string" && typeof vb === "string") return dir * va.localeCompare(vb);
      return dir * ((va as number) - (vb as number));
    });

    return result;
  }, [ads, fuse, hookFilter, tempFilter, competitorFilter, activeOnly, evergreenOnly, search, sort]);

  function SortTh({ field, children }: { field: SortField; children: React.ReactNode }) {
    const active = sort.field === field;
    return (
      <th
        className="text-left px-4 py-3 cursor-pointer select-none hover:text-white transition-colors"
        style={{ color: active ? "var(--ink)" : "var(--ink-3)" }}
        onClick={() => toggleSort(field)}
      >
        {children}
        <span className="ml-1 opacity-60">{active ? (sort.dir === "asc" ? "↑" : "↓") : ""}</span>
      </th>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          placeholder="Search headline, body, CTA… (min 3 chars)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="text-sm px-3 py-1.5 rounded border outline-none min-w-[240px]"
          style={{ background: "var(--bg-3)", borderColor: "var(--border)", color: "var(--ink)" }}
        />

        {showCompetitorCol && competitors.length > 0 && (
          <select
            value={competitorFilter}
            onChange={(e) => setCompetitorFilter(e.target.value)}
            className="text-sm px-2 py-1.5 rounded border outline-none"
            style={{ background: "var(--bg-3)", borderColor: "var(--border)", color: "var(--ink)" }}
          >
            <option value="all">All competitors</option>
            {competitors.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}

        <select
          value={hookFilter}
          onChange={(e) => setHookFilter(e.target.value)}
          className="text-sm px-2 py-1.5 rounded border outline-none"
          style={{ background: "var(--bg-3)", borderColor: "var(--border)", color: "var(--ink)" }}
        >
          <option value="all">All hooks</option>
          {hookAngles.map((h) => (
            <option key={h} value={h}>{h}</option>
          ))}
        </select>

        <select
          value={tempFilter}
          onChange={(e) => setTempFilter(e.target.value)}
          className="text-sm px-2 py-1.5 rounded border outline-none"
          style={{ background: "var(--bg-3)", borderColor: "var(--border)", color: "var(--ink)" }}
        >
          <option value="all">All temps</option>
          {temperatures.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <label className="flex items-center gap-1.5 text-sm cursor-pointer" style={{ color: "var(--ink-2)" }}>
          <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} className="accent-indigo-500" />
          Active only
        </label>

        <label className="flex items-center gap-1.5 text-sm cursor-pointer" style={{ color: "var(--ink-2)" }}>
          <input type="checkbox" checked={evergreenOnly} onChange={(e) => setEvergreenOnly(e.target.checked)} className="accent-indigo-500" />
          Evergreen ★
        </label>

        <span className="text-xs ml-auto" style={{ color: "var(--ink-3)" }}>
          {filtered.length} / {ads.length} ads
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr
              className="text-xs uppercase tracking-wider border-b"
              style={{ background: "var(--bg-3)", borderColor: "var(--border)", color: "var(--ink-3)" }}
            >
              {showCompetitorCol && (
                <SortTh field="competitor_id">Competitor</SortTh>
              )}
              <th className="text-left px-4 py-3 w-16" style={{ color: "var(--ink-3)" }}>Creative</th>
              <SortTh field="headline">Headline + Body</SortTh>
              <th className="text-left px-4 py-3" style={{ color: "var(--ink-3)" }}>Hook / Temp</th>
              <th className="text-left px-4 py-3" style={{ color: "var(--ink-3)" }}>CTA</th>
              <SortTh field="started_at">Dates</SortTh>
              <SortTh field="duration_days">Run</SortTh>
              <th className="text-left px-4 py-3" style={{ color: "var(--ink-3)" }}>Status</th>
              <th className="text-left px-4 py-3" style={{ color: "var(--ink-3)" }}>Link</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={showCompetitorCol ? 9 : 8}
                  className="text-center py-10"
                  style={{ color: "var(--ink-3)" }}
                >
                  No ads match these filters.
                </td>
              </tr>
            )}
            {filtered.map((ad) => {
              const endLabel = ad.ended_at ? fmtDate(ad.ended_at) : (ad.is_active ? "active" : "?");
              const dateRange = `${fmtDate(ad.started_at)} → ${endLabel}`;
              const variantSuffix = (ad.creative_variants ?? 0) > 1 ? ` (${ad.creative_variants}×)` : "";

              return (
                <tr
                  key={ad.id}
                  className="border-b last:border-0 transition-colors"
                  style={{ borderColor: "var(--border)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-3)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                >
                  {showCompetitorCol && competitorMap && (
                    <td className="px-4 py-3 align-top text-xs whitespace-nowrap" style={{ color: "var(--ink-2)" }}>
                      {competitorMap.get(ad.competitor_id) ?? ad.competitor_id}
                    </td>
                  )}
                  <td className="px-4 py-3 align-top">
                    {ad.ad_library_url ? (
                      <a
                        href={ad.ad_library_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open in Meta Ad Library"
                        className="block"
                      >
                        <AdThumb
                          competitorId={ad.competitor_id}
                          libraryId={ad.library_id}
                          size="md"
                          alt={ad.headline ?? `Ad ${ad.library_id}`}
                        />
                      </a>
                    ) : (
                      <AdThumb
                        competitorId={ad.competitor_id}
                        libraryId={ad.library_id}
                        size="md"
                        alt={ad.headline ?? `Ad ${ad.library_id}`}
                      />
                    )}
                  </td>
                  <td className="px-4 py-3 align-top" style={{ maxWidth: "420px" }}>
                    {ad.ad_library_url ? (
                      <a
                        href={ad.ad_library_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block group"
                        title="Open in Meta Ad Library"
                      >
                        <p
                          className="font-medium line-clamp-2 group-hover:text-indigo-300 transition-colors"
                          style={{ color: "var(--ink)" }}
                        >
                          {ad.headline ?? "—"}
                        </p>
                        {ad.body && (
                          <p className="text-xs mt-1 line-clamp-4" style={{ color: "var(--ink-3)" }}>
                            {ad.body}
                          </p>
                        )}
                      </a>
                    ) : (
                      <div>
                        <p className="font-medium line-clamp-2" style={{ color: "var(--ink)" }}>
                          {ad.headline ?? "—"}
                        </p>
                        {ad.body && (
                          <p className="text-xs mt-1 line-clamp-4" style={{ color: "var(--ink-3)" }}>
                            {ad.body}
                          </p>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex flex-col gap-1">
                      {ad.hook_angle && (
                        <span
                          className="text-xs px-2 py-0.5 rounded-full w-fit"
                          style={{ background: "var(--bg-3)", border: "1px solid var(--border)", color: "var(--ink-2)" }}
                        >
                          {ad.hook_angle}
                        </span>
                      )}
                      {ad.traffic_temperature && (
                        <span className="text-xs" style={{ color: "var(--ink-3)" }}>
                          {ad.traffic_temperature}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    {ad.cta ? (
                      <span
                        className="text-xs px-2 py-0.5 rounded"
                        style={{ background: "var(--bg-3)", color: "var(--ink-2)" }}
                      >
                        {ad.cta}
                      </span>
                    ) : (
                      <span style={{ color: "var(--ink-3)" }}>—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top text-xs whitespace-nowrap" style={{ color: "var(--ink-2)" }}>
                    {dateRange}
                  </td>
                  <td className="px-4 py-3 align-top text-xs font-mono whitespace-nowrap">
                    {ad.duration_days != null ? (
                      <span style={{ color: ad.duration_days >= 100 ? "#86efac" : "var(--ink-2)" }}>
                        {ad.duration_days}d{variantSuffix}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <span className="text-xs" style={{ color: ad.is_active ? "#86efac" : "var(--ink-3)" }}>
                      {ad.is_active ? "Active" : "Ended"}
                    </span>
                    {ad.is_evergreen_winner && (
                      <span className="ml-1 text-xs text-yellow-400">★</span>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    {ad.ad_library_url ? (
                      <a
                        href={ad.ad_library_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                      >
                        FB ↗
                      </a>
                    ) : (
                      <span style={{ color: "var(--ink-3)" }}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
