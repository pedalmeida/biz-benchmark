// Single source of truth for every closed vocabulary the app uses.
// Consumed by: apps/admin (UI dropdowns/tooltips + Claude prompts) and
// apps/worker (hook/temperature classification prompts). No CHECK
// constraints enforce these in the DB — an unexpected LLM value becomes
// `null` with a logged warning at write time, not a failed insert, since
// this vocabulary is expected to evolve as more niches get benchmarked.

export type TaxonomyTerm = {
  value: string;
  label: string;
  description: string;
};

export const HOOK_ANGLES: TaxonomyTerm[] = [
  { value: "problem-callout", label: "Problem callout", description: "Names the reader's problem directly in the first line." },
  { value: "outcome-promise", label: "Outcome promise", description: "Leads with the result the reader gets, not the mechanism." },
  { value: "curiosity-gap", label: "Curiosity gap", description: "Withholds information to make the reader click to resolve it." },
  { value: "social-proof", label: "Social proof", description: "Leads with numbers, reviews, or other customers' results." },
  { value: "authority", label: "Authority", description: "Leads with credentials, press, or an expert's endorsement." },
  { value: "offer-price", label: "Offer / price", description: "Leads with the deal itself — price, bundle, discount." },
  { value: "urgency-scarcity", label: "Urgency / scarcity", description: "Leads with a deadline or limited availability." },
  { value: "identity", label: "Identity", description: "Speaks to who the reader is or wants to be, not what they'll get." },
  { value: "quiz-segmentation", label: "Quiz / segmentation", description: "Invites the reader to self-select into a path via a question." },
  { value: "educational", label: "Educational", description: "Leads by teaching something useful, sells only at the end." },
];

export const TRAFFIC_TEMPERATURES: TaxonomyTerm[] = [
  { value: "cold", label: "Cold", description: "Targets strangers who don't know the business yet." },
  { value: "warm", label: "Warm", description: "Targets people who've engaged before (site visitors, followers, past leads)." },
  { value: "hot", label: "Hot", description: "Targets existing customers or highly qualified leads close to buying." },
];

export const AD_STRATEGIES: TaxonomyTerm[] = [
  { value: "always-on", label: "Always-on", description: "The same core ads run continuously with minor rotation." },
  { value: "event-funnel", label: "Event funnel", description: "Ads build toward a specific dated event (launch, webinar, sale)." },
  { value: "event-pulse", label: "Event pulse", description: "Short bursts of spend around recurring events, otherwise quiet." },
  { value: "decentralized", label: "Decentralized", description: "Many small, disconnected campaigns with no unifying thread." },
  { value: "multi-brand", label: "Multi-brand", description: "Runs several distinct brand identities in parallel." },
  { value: "course-finder", label: "Course finder", description: "Ads route into a segmentation quiz rather than a single offer." },
  { value: "none", label: "None", description: "No meaningful paid ad activity detected." },
];

export const FUNNEL_ROLES: TaxonomyTerm[] = [
  { value: "ad", label: "Ad", description: "The paid ad itself, the first touchpoint." },
  { value: "bridge", label: "Bridge", description: "A page that reframes belief before the offer is shown." },
  { value: "opt-in", label: "Opt-in", description: "Captures an email/contact in exchange for a free resource." },
  { value: "sales", label: "Sales", description: "The page presenting the paid offer and asking for the sale." },
  { value: "order-bump", label: "Order bump", description: "A small add-on offered at the point of purchase." },
  { value: "upsell", label: "Upsell", description: "A bigger offer presented immediately after purchase." },
  { value: "thank-you", label: "Thank-you", description: "Post-purchase or post-opt-in confirmation page." },
  { value: "continuity", label: "Continuity", description: "A recurring/subscription offer presented in the funnel." },
];

export const OFFER_CATEGORIES: TaxonomyTerm[] = [
  { value: "intro", label: "Intro", description: "A low-cost or free entry offer designed to convert cold traffic." },
  { value: "flagship", label: "Flagship", description: "The core paid program the business is best known for." },
  { value: "premium", label: "Premium", description: "A higher-priced, higher-touch version of the flagship offer." },
  { value: "continuity", label: "Continuity", description: "A recurring subscription or membership offer." },
  { value: "one-off", label: "One-off", description: "A single-purchase offer with no ongoing relationship implied." },
];

export const MAGNET_TYPES: TaxonomyTerm[] = [
  { value: "pdf", label: "PDF", description: "A downloadable document." },
  { value: "course", label: "Course", description: "A free multi-part educational sequence." },
  { value: "quiz", label: "Quiz", description: "An interactive self-assessment that segments the lead." },
  { value: "webinar", label: "Webinar", description: "A live or recorded video presentation." },
  { value: "tool", label: "Tool", description: "An interactive calculator, template, or utility." },
  { value: "template", label: "Template", description: "A ready-to-use document or file the reader copies." },
  { value: "newsletter", label: "Newsletter", description: "An ongoing email subscription with no single deliverable." },
  { value: "free-session", label: "Free session", description: "A complimentary consultation or intro call." },
];

const ALL_TAXONOMIES = {
  HOOK_ANGLES,
  TRAFFIC_TEMPERATURES,
  AD_STRATEGIES,
  FUNNEL_ROLES,
  OFFER_CATEGORIES,
  MAGNET_TYPES,
} as const;

export function isValidTaxonomyValue(
  taxonomy: keyof typeof ALL_TAXONOMIES,
  value: string | null | undefined
): boolean {
  if (!value) return false;
  return ALL_TAXONOMIES[taxonomy].some((t) => t.value === value);
}
