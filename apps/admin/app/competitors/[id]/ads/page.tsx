import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCompetitor, listAds } from "@/lib/queries";
import { TabNav } from "@/components/tab-nav";
import { AdsTable } from "@/components/ads-table";
import { SignOutButton } from "@/components/sign-out-button";

export default async function AdsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;
  const [competitor, ads] = await Promise.all([
    getCompetitor(id),
    listAds(id),
  ]);
  if (!competitor) notFound();

  const ladderLen = Array.isArray(competitor.value_ladder) ? competitor.value_ladder.length : 0;
  const tabs = [
    { label: "Overview", href: `/competitors/${id}` },
    { label: `Ads (${ads.length})`, href: `/competitors/${id}/ads` },
    { label: `Value Ladder (${ladderLen})`, href: `/competitors/${id}/ladder` },
    { label: "Analyses", href: `/competitors/${id}/analyses` },
  ];

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
          <Link href={`/competitors/${id}`} className="text-sm" style={{ color: "var(--ink-3)" }}>
            {competitor.name}
          </Link>
          <span style={{ color: "var(--ink-3)" }}>/</span>
          <span className="text-sm" style={{ color: "var(--ink)" }}>
            Ads
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs" style={{ color: "var(--ink-3)" }}>
            {session.user?.email}
          </span>
          <SignOutButton />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold mb-1" style={{ color: "var(--ink)" }}>
            {competitor.name}
          </h1>
          {competitor.one_line_summary && (
            <p className="text-sm" style={{ color: "var(--ink-2)" }}>
              {competitor.one_line_summary}
            </p>
          )}
        </div>

        <TabNav tabs={tabs} />

        <div className="mt-6">
          <AdsTable ads={ads} showCompetitorCol={false} />
        </div>
      </main>
    </div>
  );
}
