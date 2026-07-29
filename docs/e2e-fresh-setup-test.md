# Fresh-setup test prompt

Copy everything below the line into a NEW coding-agent session (different
model or machine than the one that built this repo) that has never seen
this repository before. The point is to prove a total stranger — with no
context from any prior conversation — can go from nothing to one real
benchmark run using only the public repo and their own accounts. Anywhere
the agent gets stuck or has to guess, that's a real gap in the setup docs,
not a fluke — report it back verbatim.

---

You are setting up a tool called **biz-benchmark** from scratch, as if you
were a random person who just found it online and wants to try it. You have
never seen this repo before. Do not assume anything about it beyond what
you read in its own files.

Repo: `https://github.com/pedalmeida/biz-benchmark`

**Your job:** clone it, read its README, and follow its own instructions to
get a single real benchmark run to completion. Do not take any shortcut
that a real stranger wouldn't have available to them (e.g. don't reuse
someone else's database or API keys — help me create my own).

**What you'll need from me along the way** (ask when you actually need
each one, not all up front):
- A Neon Postgres connection string. If I don't have one, tell me exactly
  where to go (neon.tech) and what to click to get a fresh project and
  connection string — a brand new project, not one I already have.
- A Firecrawl API key (firecrawl.dev).
- An Anthropic API key (console.anthropic.com).
- Anything else the README says is required that isn't listed above — if
  you find something, that itself is a finding, tell me.

**Steps:**
1. Clone the repo to a clean local directory.
2. Read the README top to bottom. Follow its setup steps literally, in
   order. Do not skip a step because it looks optional unless the README
   says it's optional.
3. Get the schema applied to a fresh Neon database.
4. Install dependencies exactly as the README says (note if it says
   something different from "npm install once at the repo root" — that
   matters, this is an npm workspace).
5. Get both apps (`apps/worker`, `apps/admin`) running locally.
6. Open the admin app in a browser, go to **Runs → New benchmark**, and
   submit one real niche (pick something concrete and different from
   whatever example the README uses — e.g. if the README's example is
   dental clinics, try something else, like "yoga studios" or "estúdios de
   yoga").
7. Watch the run to completion (it polls its own status, just wait).
8. Confirm: at least one competitor was discovered and included, and it
   has real ad data (not zero ads across the board).

**Report back, in this order:**
1. **Pass/fail** — did a run reach "ready" (or a legitimate
   "no_competitors_found" for a genuinely thin niche) with real data?
2. **Every point where you had to guess, infer, or where the README was
   silent, wrong, or ambiguous.** Quote the exact README line if you can.
   This is the most important part of the report — a smooth run with zero
   friction points reported is suspicious, not reassuring.
3. **Any error message you hit**, verbatim, and what you did to resolve it
   (or didn't).
4. **Total wall-clock time** from "git clone" to a completed run.
5. Anything you'd tell a non-technical-but-agent-assisted person to expect
   or watch out for, in one or two sentences.

Do not fix bugs in the repo yourself unless a step is completely blocked
with no workaround — if you do have to patch something to get unstuck,
that's a critical finding, report the exact patch and why it was needed.
