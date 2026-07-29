export default function Loading() {
  return (
    <div className="min-h-screen animate-pulse" style={{ background: "var(--bg)" }}>
      <div className="h-16 border-b" style={{ borderColor: "var(--border)" }} />
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-4">
        <div className="h-8 w-64 rounded" style={{ background: "var(--bg-3)" }} />
        <div className="h-4 w-96 rounded" style={{ background: "var(--bg-3)" }} />
        <div className="grid grid-cols-3 gap-4 mt-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 rounded-lg" style={{ background: "var(--bg-3)" }} />
          ))}
        </div>
      </div>
    </div>
  );
}
