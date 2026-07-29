import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";

export type Framework =
  | "brunson-funnel"
  | "hormozi-grand-slam"
  | "dream-100"
  | "challenger-recommendation";

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 16000;

// skill-refs/ sits at the repo root: apps/admin → ../../skill-refs
const SKILL_REFS_DIR = path.resolve(process.cwd(), "..", "..", "skill-refs");

function readRef(relPath: string): string {
  return fs.readFileSync(path.join(SKILL_REFS_DIR, relPath), "utf-8");
}

function frameworkRefs(framework: Framework): string {
  switch (framework) {
    case "brunson-funnel":
      return [
        "# Brunson Funnel Reference\n",
        "## Funnel Types\n" + readRef("brunson/funnel-types.md"),
        "## Linchpin Framework\n" + readRef("brunson/linchpin-framework.md"),
        "## Hook / Story / Offer\n" + readRef("brunson/hook-story-offer.md"),
      ].join("\n\n");
    case "hormozi-grand-slam":
      return [
        "# Hormozi Grand Slam Reference\n",
        "## Grand Slam Checklist\n" + readRef("hormozi/grand-slam-checklist.md"),
        "## Value Equation\n" + readRef("hormozi/value-equation.md"),
      ].join("\n\n");
    case "dream-100":
      return "# Dream 100 Playbook\n\n" + readRef("brunson/dream-100-playbook.md");
    case "challenger-recommendation":
      // TODO(step 4): inject requester context here (business name, budget
      // band, goal) from runs.requester_context once the runs table lands —
      // see the design doc in docs/. Today this framework has no operator
      // context loaded, only the generic marketing theory below.
      return [
        "# Challenger Recommendation Reference\n",
        "## Funnel Types\n" + readRef("brunson/funnel-types.md"),
        "## Linchpin Framework\n" + readRef("brunson/linchpin-framework.md"),
        "## Hook / Story / Offer\n" + readRef("brunson/hook-story-offer.md"),
        "## Dream 100 Playbook\n" + readRef("brunson/dream-100-playbook.md"),
        "## Grand Slam Checklist\n" + readRef("hormozi/grand-slam-checklist.md"),
        "## Value Equation\n" + readRef("hormozi/value-equation.md"),
      ].join("\n\n");
  }
}

function frameworkInstructions(framework: Framework): string {
  switch (framework) {
    case "brunson-funnel":
      return `Produce a Brunson-style funnel analysis of this competitor. Cover:
1. **Funnel type classification** — which of the 6 funnel archetypes does this org operate? Cite evidence.
2. **Hook / Story / Offer breakdown** — what's their hook, story, offer in the live ads + funnel pages? Where does each show up?
3. **Linchpin / Value Ladder** — where do they have a continuity offer? Where are the rungs? Where are the gaps?
4. **What's working** — name 2-3 specific things that look like winners (long-running ads, repeated mechanisms, etc.).
5. **What's missing or weak** — name 2-3 gaps in their funnel.

Output: 600-1000 words of markdown. Use H2/H3 headings. Be specific — cite ad headlines, page URLs, prices when you have them. No filler.`;

    case "hormozi-grand-slam":
      return `Produce a Hormozi Grand Slam scoring of this competitor's flagship offer. Cover:
1. **Identify the flagship offer** — which paid program is the centerpiece? Why?
2. **Score on 4 dimensions (1-10 each)**: Dream Outcome, Perceived Likelihood of Achievement, Time Delay, Effort & Sacrifice. Justify each score with evidence from the data.
3. **Value Equation diagnosis** — which side of the equation is the weakest link?
4. **The upgrade** — name the single change that would most increase the Grand Slam score, and why.
5. **What a challenger could steal vs. invert** — what's worth copying, what's worth doing the opposite of?

Output: 500-800 words of markdown. Include the numeric scores in a small table at the top. Be specific — name the offer, cite prices, bonuses, guarantees if visible.

After the markdown, output a JSON code block (fenced as \`\`\`json) with exactly:
\`\`\`json
{"dream": N, "likelihood": N, "time": N, "effort": N}
\`\`\`
where each N is the integer 1-10 score. This will be parsed and stored.`;

    case "dream-100":
      return `Produce a Dream 100 audit of this competitor's distribution. Cover:
1. **Where they show up** — list the channels/podcasts/influencers/communities they appear on (from public_mentions and ads data).
2. **Who's likely in their Dream 100** — infer the 5-10 nodes they're targeting based on patterns in their distribution.
3. **What channels they OWN vs. RENT vs. EARN** — classify each.
4. **Gaps** — channels they should be in but aren't.
5. **Implications for a challenger** — which of these Dream 100 nodes should a challenger also be working? Which are off-limits or wrong fit?

Output: 500-800 words of markdown. Use H2/H3 headings. Name specific channels, podcasts, people where you have evidence.`;

    case "challenger-recommendation":
      return `Cross-read this competitor's data through the lens of "what should a challenger in this market do?".

Produce a strategic recommendation. Cover:
1. **What this competitor does that a challenger should steal** — 2-3 specific tactics, adapted, not generic.
2. **What this competitor does that a challenger should NOT do** — 1-2 specific things, and why they're a wrong fit.
3. **Whitespace gap** — what positioning or audience does this competitor leave open that a challenger could authentically own?
4. **First concrete step** — ONE action, named, scoped, achievable on a modest budget.

Be opinionated. Don't list possibilities — pick. Never hedge non-committally.

Output: 500-900 words of markdown. Use H2 headings.`;
  }
}

export type CompetitorBundle = {
  competitor: Record<string, unknown>;
  ads: Array<Record<string, unknown>>;
  offers: Array<Record<string, unknown>>;
  lead_magnets: Array<Record<string, unknown>>;
  funnel_steps: Array<Record<string, unknown>>;
  public_mentions: Array<Record<string, unknown>>;
};

function bundleToMarkdown(bundle: CompetitorBundle): string {
  const c = bundle.competitor;
  const lines: string[] = [];
  lines.push(`# Competitor data\n`);
  lines.push(`## Core identity\n\n\`\`\`json\n${JSON.stringify(c, null, 2)}\n\`\`\``);

  lines.push(`\n## Ads (${bundle.ads.length})\n`);
  if (bundle.ads.length === 0) {
    lines.push("*No ads on file.*");
  } else {
    for (const ad of bundle.ads) {
      lines.push(`\n### Ad ${ad.library_id ?? ad.id}`);
      lines.push(`- **Country:** ${ad.country ?? "?"}`);
      lines.push(`- **Active:** ${ad.is_active ?? "?"}  | **Duration:** ${ad.duration_days ?? "?"} days  | **Evergreen winner:** ${ad.is_evergreen_winner ?? false}`);
      lines.push(`- **Hook angle:** ${ad.hook_angle ?? "?"}  | **Temp:** ${ad.traffic_temperature ?? "?"}`);
      if (ad.headline) lines.push(`- **Headline:** ${ad.headline}`);
      if (ad.body) lines.push(`- **Body:** ${String(ad.body).slice(0, 400)}`);
      if (ad.cta) lines.push(`- **CTA:** ${ad.cta}`);
      if (ad.landing_url) lines.push(`- **Landing:** ${ad.landing_url}`);
    }
  }

  lines.push(`\n## Offers (${bundle.offers.length})\n`);
  if (bundle.offers.length === 0) {
    lines.push("*No offers on file.*");
  } else {
    for (const o of bundle.offers) {
      lines.push(`\n### ${o.name ?? "(unnamed)"} [${o.category ?? "?"}]`);
      lines.push(`- **Price:** ${o.price_actual ?? "?"} ${o.currency ?? ""} (anchor ${o.price_anchor ?? "?"})`);
      lines.push(`- **Duration:** ${o.duration ?? "?"}  | **Format:** ${o.format ?? "?"}`);
      if (o.delivery_summary) lines.push(`- **Delivery:** ${o.delivery_summary}`);
      if (o.guarantee) lines.push(`- **Guarantee:** ${o.guarantee}`);
      if (o.scarcity) lines.push(`- **Scarcity:** ${o.scarcity}`);
      if (o.url) lines.push(`- **URL:** ${o.url}`);
    }
  }

  lines.push(`\n## Lead Magnets (${bundle.lead_magnets.length})\n`);
  for (const lm of bundle.lead_magnets) {
    lines.push(`- **${lm.title ?? "(untitled)"}** [${lm.magnet_type ?? "?"}] — promise: ${lm.promise ?? "?"}  | captures: ${JSON.stringify(lm.capture_fields ?? [])}`);
  }

  lines.push(`\n## Funnel steps (${bundle.funnel_steps.length})\n`);
  for (const fs of bundle.funnel_steps) {
    lines.push(`- **${fs.funnel_name ?? "?"} step ${fs.step_index ?? "?"}** [${fs.step_role ?? "?"}] — ${fs.hero_headline ?? ""}  | CTA: ${fs.primary_cta ?? "?"}  | ${fs.url ?? ""}`);
  }

  lines.push(`\n## Public mentions (${bundle.public_mentions.length})\n`);
  for (const m of bundle.public_mentions) {
    lines.push(`- [${m.mention_type ?? "?"}] **${m.title ?? "?"}** — ${m.outlet ?? ""} (${m.date ?? "?"}) — reach ${m.reach_estimate ?? "?"}`);
  }

  return lines.join("\n");
}

export type AnalysisResult = {
  markdown: string;
  scores: Record<string, number> | null;
  model: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens: number;
    cache_creation_input_tokens: number;
  };
};

function extractScoresFromMarkdown(md: string): Record<string, number> | null {
  const match = md.match(/```json\s*([\s\S]*?)```/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1].trim());
    if (typeof parsed !== "object" || parsed === null) return null;
    return parsed as Record<string, number>;
  } catch {
    return null;
  }
}

export async function generateAnalysis(
  framework: Framework,
  bundle: CompetitorBundle,
): Promise<AnalysisResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const client = new Anthropic();

  const refs = frameworkRefs(framework);
  const instructions = frameworkInstructions(framework);
  const data = bundleToMarkdown(bundle);

  // Cache the stable prefix (system + refs). Volatile per-competitor data goes in the
  // user message after the cache breakpoint, so re-runs on the same competitor reuse the cache
  // and cross-competitor runs on the same framework also reuse it.
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: [
      {
        type: "text",
        text:
          // TODO(step 4): inject the run's niche/country here once the runs
          // table lands, e.g. `for a "${run.niche_label}" (${run.country})
          // benchmark project`. Keeping this generic for now so the cached
          // prefix stays valid across every framework call regardless of niche.
          "You are a senior marketing strategist analyzing a competitor for a market benchmark project. " +
          "Be specific, opinionated, evidence-based. Cite the competitor's actual ad headlines, prices, URLs from the data provided. " +
          "Never invent facts — if the data doesn't show something, say so.\n\n" +
          refs,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content:
          `${instructions}\n\n---\n\n${data}`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const markdown = textBlock && textBlock.type === "text" ? textBlock.text : "";

  return {
    markdown,
    scores: framework === "hormozi-grand-slam" ? extractScoresFromMarkdown(markdown) : null,
    model: response.model,
    usage: {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
      cache_creation_input_tokens: response.usage.cache_creation_input_tokens ?? 0,
    },
  };
}
