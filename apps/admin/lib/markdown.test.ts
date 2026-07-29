import { test } from "node:test";
import assert from "node:assert/strict";
import { renderMarkdown } from "./markdown";

// Release blocker regression: analyses are LLM-written from scraped competitor
// sites, so their Markdown is untrusted. These payloads are the ones the
// readiness report called out — a script tag, an image error handler and a
// javascript: link. None of them may survive into the rendered HTML.

test("strips script tags from raw HTML in Markdown", () => {
  const html = renderMarkdown(
    "Analysis intro\n\n<script>window.__pwned = true</script>\n\nMore text"
  );
  assert.ok(!html.includes("<script"), `script tag survived: ${html}`);
  assert.ok(!html.includes("__pwned"), `script body survived: ${html}`);
  assert.ok(html.includes("Analysis intro"), "legitimate content was dropped");
});

test("strips event-handler attributes (img onerror)", () => {
  const html = renderMarkdown('<img src="x" onerror="alert(1)">');
  assert.ok(!/onerror/i.test(html), `onerror survived: ${html}`);
  assert.ok(!html.includes("alert(1)"), `handler body survived: ${html}`);
});

test("strips javascript: links written as Markdown", () => {
  const html = renderMarkdown("[click me](javascript:alert(1))");
  assert.ok(!/javascript:/i.test(html), `javascript: URL survived: ${html}`);
  assert.ok(html.includes("click me"), "link text was dropped");
});

test("strips iframes and inline styles", () => {
  const html = renderMarkdown(
    '<iframe src="https://evil.example"></iframe>\n\n<p style="position:fixed">x</p>'
  );
  assert.ok(!html.includes("<iframe"), `iframe survived: ${html}`);
  assert.ok(!html.includes("position:fixed"), `inline style survived: ${html}`);
});

test("keeps the Markdown formatting analyses actually rely on", () => {
  const html = renderMarkdown(
    "## Grand Slam\n\n- **Dream outcome:** high\n- [source](https://example.com)\n\n| a | b |\n| --- | --- |\n| 1 | 2 |"
  );
  assert.ok(html.includes("<h2"), "heading lost");
  assert.ok(html.includes("<strong>"), "bold lost");
  assert.ok(html.includes('href="https://example.com"'), "safe link lost");
  assert.ok(html.includes("<table"), "table lost");
});

test("handles null and empty markdown", () => {
  assert.equal(renderMarkdown(null), "");
  assert.equal(renderMarkdown(undefined), "");
  assert.equal(renderMarkdown(""), "");
});
