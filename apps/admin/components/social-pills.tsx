import type { IntelSource } from "@/lib/queries";

type PlatformMeta = {
  label: string;
  color: string;
  icon: (className: string) => React.ReactNode;
};

// Inline brand-mark SVGs. Lucide deliberately doesn't ship these, so we keep
// minimal versions here. Sized via className.
const PLATFORMS: Record<string, PlatformMeta> = {
  instagram: {
    label: "Instagram",
    color: "#E1306C",
    icon: (className) => (
      <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
        <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.72 3.72 0 0 1-1.38-.9 3.72 3.72 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16M12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63a5.88 5.88 0 0 0-2.13 1.38A5.88 5.88 0 0 0 .63 4.14C.33 4.9.13 5.78.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91a5.88 5.88 0 0 0 1.38 2.13 5.88 5.88 0 0 0 2.13 1.38c.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56a6.13 6.13 0 0 0 3.51-3.51c.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91a5.88 5.88 0 0 0-1.38-2.13A5.88 5.88 0 0 0 19.86.63C19.1.33 18.22.13 16.95.07 15.67.01 15.26 0 12 0Zm0 5.84a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32Zm0 10.16a4 4 0 1 1 0-8 4 4 0 0 1 0 8ZM19.85 4.15a1.44 1.44 0 1 1-2.88 0 1.44 1.44 0 0 1 2.88 0Z" />
      </svg>
    ),
  },
  youtube_channel: {
    label: "YouTube",
    color: "#FF0000",
    icon: (className) => (
      <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
        <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1C24 15.9 24 12 24 12s0-3.9-.5-5.8ZM9.6 15.6V8.4l6.3 3.6-6.3 3.6Z" />
      </svg>
    ),
  },
  facebook: {
    label: "Facebook",
    color: "#1877F2",
    icon: (className) => (
      <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
        <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.69.24 2.69.24v2.97h-1.52c-1.5 0-1.96.94-1.96 1.9v2.27h3.34l-.53 3.49h-2.81V24C19.61 23.1 24 18.1 24 12.07Z" />
      </svg>
    ),
  },
  tiktok: {
    label: "TikTok",
    color: "#000000",
    icon: (className) => (
      <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V8.4a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.84-.05Z" />
      </svg>
    ),
  },
  linkedin_company: {
    label: "LinkedIn",
    color: "#0A66C2",
    icon: (className) => (
      <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
        <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.4v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.26 2.37 4.26 5.45v6.29ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .78 0 1.73v20.54C0 23.22.79 24 1.77 24h20.45c.98 0 1.78-.78 1.78-1.73V1.73C24 .78 23.2 0 22.22 0Z" />
      </svg>
    ),
  },
};

function formatFollowers(n: number | null): string | null {
  if (n == null) return null;
  if (n < 1000) return String(n);
  if (n < 10_000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  if (n < 1_000_000) return Math.round(n / 1000) + "K";
  if (n < 10_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  return Math.round(n / 1_000_000) + "M";
}

interface SocialPillsProps {
  sources: IntelSource[];
  /** "compact" hides handle and platform label, just shows icon + follower count. */
  variant?: "compact" | "full";
  className?: string;
}

export function SocialPills({ sources, variant = "compact", className }: SocialPillsProps) {
  // Only show sources that have a platform we recognise as social.
  const social = sources.filter((s) => s.source_type in PLATFORMS);
  if (social.length === 0) {
    return (
      <span className="text-xs italic" style={{ color: "var(--ink-3)" }}>
        No socials on file
      </span>
    );
  }

  return (
    <div className={`flex flex-wrap gap-1.5 ${className ?? ""}`}>
      {social.map((s) => {
        const meta = PLATFORMS[s.source_type]!;
        const followers = formatFollowers(s.follower_count);
        return (
          <a
            key={s.id}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border hover:bg-[var(--bg-3)] transition-colors"
            style={{ borderColor: "var(--border)", background: "var(--bg-2)", color: "var(--ink-2)" }}
            title={`${meta.label}${s.handle ? ` @${s.handle}` : ""}${followers ? ` · ${followers} followers` : ""}`}
          >
            <span style={{ color: meta.color, display: "inline-flex" }}>
              {meta.icon("size-3.5")}
            </span>
            {variant === "full" && s.handle && (
              <span className="font-mono" style={{ color: "var(--ink-2)" }}>
                @{s.handle}
              </span>
            )}
            {followers ? (
              <span className="font-semibold" style={{ color: "var(--ink)" }}>
                {followers}
              </span>
            ) : (
              <span style={{ color: "var(--ink-3)" }}>↗</span>
            )}
          </a>
        );
      })}
    </div>
  );
}
