export * from "./taxonomy.js";
export * from "./discovery-filters.js";
export * from "./cost-estimate.js";

// An ad running this many days or longer is treated as a proven, repeatable
// winner rather than a short-lived test — used to set ads.is_evergreen_winner
// right after every upsert, deterministically, no LLM involved.
export const EVERGREEN_MIN_DAYS = 90;
