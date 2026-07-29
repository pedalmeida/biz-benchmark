// This admin ships with no login on purpose: it is a local, single-user tool.
// That choice is only safe while it stays local, so the trade-off is stated in
// the UI itself, not just in the README — anyone who reaches a deployed copy
// can read every dossier and spend the owner's Firecrawl/Anthropic credits.
export function LocalOnlyBanner() {
  return (
    <div
      className="w-full px-6 py-2 text-xs flex items-center gap-2 border-b"
      style={{
        background: "#7c2d12",
        borderColor: "#9a3412",
        color: "#fed7aa",
      }}
      role="note"
    >
      <span aria-hidden="true">⚠</span>
      <span>
        <strong className="font-semibold">No authentication.</strong> This admin
        is for local use only. Anyone who can reach this URL can read every
        dossier and spend your API credits — if you host it anywhere, put it
        behind your own access gate first.
      </span>
    </div>
  );
}
