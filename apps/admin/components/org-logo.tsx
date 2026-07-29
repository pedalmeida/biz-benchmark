"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg";

const SIZE_CLASSES: Record<Size, string> = {
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-12 text-base",
};

const FAVICON_SIZE: Record<Size, number> = {
  sm: 64,
  md: 64,
  lg: 128,
};

function hostFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function initialsFromName(name: string): string {
  // Drop punctuation and take first letter of up to 2 significant words.
  const cleaned = name.replace(/[^\p{L}\p{N}\s]/gu, "").trim();
  const words = cleaned.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

interface OrgLogoProps {
  /** Org name — used for the letter fallback. */
  name: string;
  /** Primary site URL — extracts host for the favicon API. */
  siteUrl?: string | null;
  size?: Size;
  className?: string;
}

/**
 * Renders the org's favicon via Google's free favicon API
 * (https://www.google.com/s2/favicons?domain=<host>&sz=64). On error, falls back
 * to a coloured initials avatar derived from the org name.
 */
export function OrgLogo({ name, siteUrl, size = "md", className }: OrgLogoProps) {
  const host = hostFromUrl(siteUrl);
  const [failed, setFailed] = useState(!host);
  const sizeClass = SIZE_CLASSES[size];

  if (failed || !host) {
    const initials = initialsFromName(name);
    // Stable hash → hue. Avoids the AI-slop purple-gradient default.
    const hue = (() => {
      let h = 0;
      for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
      return h;
    })();
    return (
      <div
        className={cn(
          sizeClass,
          "shrink-0 rounded-md flex items-center justify-center font-semibold uppercase tracking-tight select-none",
          className,
        )}
        style={{
          background: `hsl(${hue} 25% 22%)`,
          color: `hsl(${hue} 50% 78%)`,
        }}
        aria-label={`${name} logo`}
        title={name}
      >
        {initials}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=${FAVICON_SIZE[size]}`}
      alt={`${name} logo`}
      onError={() => setFailed(true)}
      loading="lazy"
      className={cn(
        sizeClass,
        "shrink-0 rounded-md object-contain bg-white p-1 border border-border",
        className,
      )}
    />
  );
}
