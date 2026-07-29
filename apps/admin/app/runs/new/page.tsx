import Link from "next/link";
import { createRunAction } from "./actions";

export default async function NewRunPage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <header
        className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b"
        style={{ background: "var(--bg)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-3">
          <Link href="/runs" className="text-sm" style={{ color: "var(--ink-3)" }}>
            Runs
          </Link>
          <span style={{ color: "var(--ink-3)" }}>/</span>
          <span className="text-sm" style={{ color: "var(--ink)" }}>
            New
          </span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-semibold mb-2" style={{ color: "var(--ink)" }}>
          Benchmark a niche
        </h1>
        <p className="text-sm mb-8" style={{ color: "var(--ink-3)" }}>
          Automatically discovers who&apos;s advertising in this market on Meta and
          builds a dossier per competitor. Takes a few minutes.
        </p>

        <form action={createRunAction} className="space-y-5">
          <Field
            label="Niche"
            name="nicheLabel"
            required
            placeholder="clínicas dentárias"
          />
          <Field
            label="Country (ISO-2)"
            name="country"
            defaultValue="PT"
            placeholder="PT"
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
              Start benchmark
            </button>
            <Link href="/runs" className="text-xs" style={{ color: "var(--ink-3)" }}>
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
  required = false,
  placeholder,
  defaultValue,
}: {
  label: string;
  name: string;
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
        type="text"
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
