import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { addCompetitorAction } from "./actions";

const ORG_TYPES = [
  "tibetan-buddhist",
  "hindu-devotional",
  "yogic-science",
  "classical-yoga",
  "breath-wellness",
  "unknown",
];

export default async function NewCompetitorPage() {
  const session = await auth();
  if (!session) redirect("/login");

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
            New
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs" style={{ color: "var(--ink-3)" }}>
            {session.user?.email}
          </span>
          <SignOutButton />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-semibold mb-2" style={{ color: "var(--ink)" }}>
          Add Competitor
        </h1>
        <p className="text-sm mb-8" style={{ color: "var(--ink-3)" }}>
          Creates the competitor and immediately triggers a Meta Ad Library scrape.
        </p>

        <form action={addCompetitorAction} className="space-y-5">
          <Field label="Name" name="name" required placeholder="Vale de Moses" />
          <Field
            label="Meta page handle (search query)"
            name="pageHandle"
            placeholder="Defaults to name. Use the exact page name you see on Meta Ad Library."
          />
          <Field
            label="Primary site URL"
            name="primary_site_url"
            placeholder="https://valedemoses.com"
            type="url"
          />
          <div className="grid grid-cols-2 gap-4">
            <Field label="HQ country (ISO)" name="hq_country" defaultValue="PT" />
            <Field label="Scrape country (ISO)" name="country" defaultValue="PT" />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--ink-3)" }}>
              Org type
            </label>
            <select
              name="org_type"
              defaultValue=""
              className="w-full px-3 py-2 text-sm rounded border"
              style={{
                background: "var(--bg-2)",
                color: "var(--ink)",
                borderColor: "var(--border)",
              }}
            >
              <option value="">— select —</option>
              {ORG_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <Field
            label="One-line summary"
            name="one_line_summary"
            placeholder="Yoga + nature retreat center in central Portugal."
          />

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              className="text-xs px-4 py-2 rounded border transition-colors"
              style={{
                background: "var(--ink)",
                color: "var(--bg)",
                borderColor: "var(--ink)",
              }}
            >
              Create + scrape
            </button>
            <Link
              href="/dashboard"
              className="text-xs"
              style={{ color: "var(--ink-3)" }}
            >
              Cancel
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
  placeholder,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <div>
      <label className="block text-xs mb-1" style={{ color: "var(--ink-3)" }}>
        {label}
        {required && <span style={{ color: "#f87171" }}> *</span>}
      </label>
      <input
        type={type}
        name={name}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="w-full px-3 py-2 text-sm rounded border"
        style={{
          background: "var(--bg-2)",
          color: "var(--ink)",
          borderColor: "var(--border)",
        }}
      />
    </div>
  );
}
