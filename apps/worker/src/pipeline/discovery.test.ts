import { test } from "node:test";
import assert from "node:assert/strict";
import { describeDiscoveryFailure } from "./discovery.js";

// Release blocker regression: a provider outage produced an empty candidate
// list, which the pipeline then reported as `no_competitors_found` — an
// infrastructure failure dressed up as a market finding. Reproduced live on a
// run where every Firecrawl keyword search errored.

test("all keywords failing is a failed run, not an empty market", () => {
  const keywords = ["dentista lisboa", "clinica dentaria", "implantes dentarios"];
  const errors = keywords.map((keyword) => ({ keyword, error: "Firecrawl 500" }));

  const message = describeDiscoveryFailure(keywords, errors);
  assert.ok(message, "total provider failure must produce a failure message");
  assert.match(message, /all 3 Ad Library searches failed/);
  assert.match(message, /Firecrawl 500/);
});

test("a partial failure still lets the run continue", () => {
  const keywords = ["dentista lisboa", "clinica dentaria", "implantes dentarios"];
  const errors = [{ keyword: "clinica dentaria", error: "timeout" }];

  assert.equal(describeDiscoveryFailure(keywords, errors), null);
});

test("a clean discovery with no candidates is not a failure", () => {
  assert.equal(describeDiscoveryFailure(["pilates porto"], []), null);
});

test("empty keyword expansion is a failed run", () => {
  const message = describeDiscoveryFailure([], []);
  assert.ok(message, "no keywords means the market was never searched");
  assert.match(message, /keyword expansion returned no keywords/);
});
