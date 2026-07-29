"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

type Size = "xs" | "sm" | "md" | "lg";

const SIZE_CLASSES: Record<Size, string> = {
  xs: "size-8",
  sm: "size-12",
  md: "size-16",
  lg: "size-24",
};

interface AdThumbProps {
  competitorId: string;
  libraryId: string;
  size?: Size;
  className?: string;
  alt?: string;
}

/**
 * Shows the ad's creative thumbnail from /ad-assets/<competitor>/<library_id>.jpg.
 * Falls back to a placeholder icon if the asset is missing (e.g., a competitor
 * scraped but not yet asset-downloaded, like ArteExtasia).
 */
export function AdThumb({
  competitorId,
  libraryId,
  size = "sm",
  className,
  alt,
}: AdThumbProps) {
  const [failed, setFailed] = useState(false);
  const sizeClass = SIZE_CLASSES[size];

  if (failed) {
    return (
      <div
        className={cn(
          sizeClass,
          "shrink-0 rounded-md border border-dashed border-border bg-muted/40 flex items-center justify-center text-muted-foreground",
          className,
        )}
        aria-label="No creative available"
        title="No creative on file"
      >
        <ImageOff className="size-3.5" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/ad-assets/${competitorId}/${libraryId}.jpg`}
      alt={alt ?? `Ad ${libraryId}`}
      onError={() => setFailed(true)}
      loading="lazy"
      className={cn(
        sizeClass,
        "shrink-0 rounded-md border border-border object-cover bg-muted",
        className,
      )}
    />
  );
}
