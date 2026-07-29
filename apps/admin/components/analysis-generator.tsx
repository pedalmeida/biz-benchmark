"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Framework =
  | "brunson-funnel"
  | "hormozi-grand-slam"
  | "dream-100"
  | "challenger-recommendation";

const FRAMEWORK_META: Record<
  Framework,
  { label: string; description: string }
> = {
  "brunson-funnel": {
    label: "Brunson Funnel",
    description:
      "Eight-element funnel breakdown, funnel-type classification, and gap analysis.",
  },
  "hormozi-grand-slam": {
    label: "Hormozi Grand Slam",
    description:
      "Score the flagship offer on Dream / Likelihood / Time / Effort. Identify the weakest link.",
  },
  "dream-100": {
    label: "Dream 100",
    description:
      "Distribution audit — where they show up, where a challenger should also be.",
  },
  "challenger-recommendation": {
    label: "Challenger Recommendation",
    description:
      "Cross-read everything through a challenger's lens — what to steal, what to invert.",
  },
};

const FRAMEWORKS: Framework[] = [
  "brunson-funnel",
  "hormozi-grand-slam",
  "dream-100",
  "challenger-recommendation",
];

export function AnalysisGenerator({ competitorId }: { competitorId: string }) {
  const router = useRouter();
  const [generating, setGenerating] = useState<Framework | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generate(framework: Framework) {
    setGenerating(framework);
    setError(null);
    try {
      const res = await fetch("/api/analyses/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competitor_id: competitorId, framework }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "generation failed");
    } finally {
      setGenerating(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {FRAMEWORKS.map((fw) => {
          const isGenerating = generating === fw;
          return (
            <Card key={fw} className="gap-3">
              <CardHeader className="pb-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle className="text-sm font-medium">
                      {FRAMEWORK_META[fw].label}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {FRAMEWORK_META[fw].description}
                    </CardDescription>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => generate(fw)}
                    disabled={generating !== null}
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        Generating
                      </>
                    ) : (
                      <>
                        <Sparkles className="size-3.5" />
                        Generate
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
            </Card>
          );
        })}
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 text-destructive p-3 text-xs"
        >
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Analysis failed</p>
            <p className="opacity-80 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {generating && (
        <p className="text-xs text-muted-foreground">
          Calling Sonnet 4.6 with the full skill reference. Typically 30–90 seconds.
        </p>
      )}
    </div>
  );
}
