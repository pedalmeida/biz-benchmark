import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { listCompetitors, listIntelSourcesByCompetitors } from "@/lib/queries";
import { CompetitorCard } from "@/components/competitor-card";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const competitors = await listCompetitors();
  const intelByCompetitor = await listIntelSourcesByCompetitors(
    competitors.map((c) => c.id),
  );

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <header
        className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b"
        style={{ background: "var(--bg)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-6">
          <span className="font-semibold text-sm" style={{ color: "var(--ink)" }}>
            AM Benchmark
          </span>
          <nav className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-xs font-medium"
              style={{ color: "var(--ink)" }}
            >
              Competitors
            </Link>
            <Link
              href="/patterns"
              className="text-xs font-medium transition-colors hover:text-white"
              style={{ color: "var(--ink-3)" }}
            >
              Patterns
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs" style={{ color: "var(--ink-3)" }}>
            {session.user?.email}
          </span>
          <ThemeToggle />
          <SignOutButton />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold" style={{ color: "var(--ink)" }}>
            Competitors
            <span className="ml-2 text-sm font-normal" style={{ color: "var(--ink-3)" }}>
              {competitors.length} total
            </span>
          </h2>
          <Link
            href="/competitors/new"
            className="text-xs px-3 py-1.5 rounded border transition-colors"
            style={{
              background: "var(--ink)",
              color: "var(--bg)",
              borderColor: "var(--ink)",
            }}
          >
            + New competitor
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {competitors.map((c) => (
            <CompetitorCard
              key={c.id}
              competitor={c}
              intelSources={intelByCompetitor.get(c.id) ?? []}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
