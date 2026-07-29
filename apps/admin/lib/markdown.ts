import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";

// The Markdown rendered by the admin is written by an LLM whose input is
// scraped competitor websites and ad copy. That makes it attacker-influenced
// text: a competitor page can carry instructions or raw HTML that ends up
// verbatim inside an analysis. Rendering that through dangerouslySetInnerHTML
// without sanitizing is a stored-XSS path, so every Markdown → HTML conversion
// in this app MUST go through renderMarkdown, never through marked directly.
//
// DOMPurify's defaults already drop <script>, event-handler attributes and
// javascript: URLs. The explicit lists below add the tags/attributes that are
// dangerous in this app specifically (embedded frames, form posts, CSS
// injection) and are never legitimate in a generated analysis.
const FORBID_TAGS = [
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "form",
  "input",
  "button",
  "textarea",
  "select",
  "link",
  "meta",
  "base",
  "svg",
  "math",
];

const FORBID_ATTR = ["style", "srcset", "formaction", "form", "ping"];

export function renderMarkdown(markdown: string | null | undefined): string {
  if (!markdown) return "";

  // async: false keeps marked on the synchronous path so this returns a
  // string (marked.parse is string | Promise<string> otherwise).
  const rawHtml = marked.parse(markdown, { async: false });

  return DOMPurify.sanitize(rawHtml, {
    FORBID_TAGS,
    FORBID_ATTR,
    // Anything not in this scheme list (javascript:, data:, vbscript:) is
    // stripped from href/src.
    ALLOWED_URI_REGEXP: /^(?:https?|mailto|tel):/i,
  });
}
