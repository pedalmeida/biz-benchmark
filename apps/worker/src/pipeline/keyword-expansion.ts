import Anthropic from "@anthropic-ai/sdk";

export type KeywordExpansion = {
  keywords: string[];
  language: string;
};

// Cheap, structured task — a small model is enough and keeps this call's
// cost negligible even though it runs on every single run.
const MODEL = "claude-haiku-4-5-20251001";

function extractJson(text: string): unknown {
  const match = text.match(/```json\s*([\s\S]*?)```/);
  const raw = match ? match[1] : text;
  return JSON.parse(raw);
}

export async function expandKeywords(
  nicheLabel: string,
  country: string
): Promise<KeywordExpansion> {
  const maxKeywords = parseInt(process.env.MAX_KEYWORDS_PER_RUN ?? "5", 10);
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 400,
    messages: [
      {
        role: "user",
        content: `A user wants to benchmark competitors in this niche: "${nicheLabel}" in country ${country}.

Produce up to ${maxKeywords} distinct search keywords or short phrases someone would type to find businesses in this niche — synonyms, closely related services, natural phrasings. Use the SAME language as the niche label (do not translate it). Also detect that language as an ISO 639-1 code.

Output ONLY a fenced JSON block, nothing else:
\`\`\`json
{"keywords": ["...", "..."], "language": "pt"}
\`\`\``,
      },
    ],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const parsed = extractJson(text) as { keywords?: unknown; language?: unknown };
  if (!Array.isArray(parsed.keywords) || typeof parsed.language !== "string") {
    throw new Error(`keyword expansion: malformed response — ${text.slice(0, 300)}`);
  }

  return {
    keywords: parsed.keywords.slice(0, maxKeywords).map(String),
    language: parsed.language,
  };
}
