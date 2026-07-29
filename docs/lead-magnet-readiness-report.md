# Lead Magnet Readiness Report

**Product:** Biz Benchmark

**Audience:** Pedro's Portuguese Instagram audience, including nontechnical users

**Review date:** 2026-07-29

**Reviewed version:** Public commit `4da8b0c`

**Repository at delivery:** `radar-da-concorrencia`

## Executive verdict

The benchmark can produce useful competitor research, but the repository is not ready for broad distribution as a self-service lead magnet.

The immediate problem is not visual design. It is the experience between downloading the repository and receiving a trustworthy first result. New users currently need to configure several paid services, apply a database schema, manage secrets, and run two applications. If something fails, the product exposes technical errors without a clear recovery path.

The short-term objective should not be to redesign the architecture. It should be to create a safer, guided local experience that a motivated beginner can complete without Pedro's help.

## Short-term definition of done

The repository is ready for a limited lead-magnet release when:

1. A new user can follow one Portuguese guide from clone to first run.
2. One root command starts the complete application.
3. A diagnostic command identifies missing or invalid configuration before a paid run begins.
4. Paid actions require explicit confirmation.
5. Provider failures cannot appear as valid benchmark conclusions.
6. A failed run explains the problem and offers a working retry path.
7. Generated content cannot execute scripts in the browser.
8. A default installation cannot be exposed publicly without access protection.

## Quick wins to complete before the giveaway

| Priority | Quick win | Why it matters | Effort |
|---|---|---|---:|
| P0 | Sanitize generated Markdown | Removes the stored script injection vulnerability | 1 to 2 hours |
| P0 | Add access protection or enforce local-only use | Prevents strangers from reading data and consuming paid credits | 2 to 4 hours |
| P0 | Correct failure status handling | Prevents outages from becoming false market conclusions | 2 to 4 hours |
| P1 | Make retries create a valid new run | Gives users a recovery path after a failed benchmark | 2 to 4 hours |
| P1 | Add root `dev` and `doctor` commands | Removes terminal and configuration guesswork | 3 to 6 hours |
| P1 | Add a Portuguese `START-HERE.md` | Gives the intended audience one clear path through setup | 3 to 4 hours |
| P1 | Improve the new-run confirmation screen | Makes cost, duration, and prerequisites visible before paid work | 2 to 4 hours |
| P2 | Replace raw errors with actionable messages | Helps beginners recover without reading logs or code | 2 to 4 hours |
| P2 | Patch Next.js and repair linting | Removes known dependency risk and restores a basic quality check | 1 to 3 hours |
| P2 | Add three critical smoke tests | Protects the release blockers from returning | 3 to 5 hours |

Estimated total: approximately 2 focused development days, excluding unexpected integration issues.

## Recommended implementation details

### 1. Sanitize generated Markdown

**Current risk:** AI-generated Markdown is converted to HTML and rendered directly. Scraped website content can influence that output.

**Short-term action:**

- Sanitize the generated HTML with an established library.
- Remove raw HTML, event-handler attributes, scripts, iframes, and unsafe URL schemes.
- Add a regression test containing a script tag, an image error handler, and a JavaScript link.

**Acceptance check:** None of the test payloads execute or remain as unsafe HTML in the rendered page.

### 2. Protect access by default

**Current risk:** The admin and paid actions do not require authentication.

**Short-term action:**

- Make local-only operation the documented default.
- Add a mandatory `APP_PASSWORD` or equivalent access gate if the admin is deployed.
- Refuse to start a production deployment when access protection is missing.
- Clearly state that this version is not designed as a public multi-user service.

**Acceptance check:** An unauthenticated visitor cannot view benchmark data or trigger Anthropic and Firecrawl requests.

### 3. Separate provider failure from market findings

**Current risk:** If discovery requests fail, an empty result can be presented as `no_competitors_found`. Deep-scraping failures can also be ignored while a run becomes ready.

**Short-term action:**

- Mark the run as failed when all discovery providers fail.
- Mark incomplete enrichment as partial or failed.
- Only use `no_competitors_found` when discovery completed successfully and returned no candidates.
- Store a short user-facing error code separately from technical logs.

**Acceptance check:** Simulated provider timeouts never produce a successful benchmark or a “no competitors” conclusion.

### 4. Make retry work

**Current risk:** Run identifiers are based on niche, country, and date. Retrying the same benchmark on the same day can collide with the previous record.

**Short-term action:**

- Give every run a unique identifier, such as a timestamp or UUID suffix.
- Add a retry button to the failed-run screen.
- Copy the original niche and country into the new attempt.
- Keep the failed attempt available for diagnosis.

**Acceptance check:** A user can retry the same niche and country twice on the same day without a database conflict.

### 5. Add one-command startup and diagnostics

**Current friction:** Users must understand workspaces, build order, two applications, environment files, and service URLs.

**Short-term action:**

- Add a root `npm run dev` command that builds the shared package and starts the admin and worker.
- Add `npm run doctor` to validate:
  - Supported Node version
  - Required environment variables
  - Database connectivity and schema
  - Worker connectivity
  - Anthropic and Firecrawl key presence
  - Shared-secret consistency
- Print the exact local URL when startup succeeds.

**Acceptance check:** A new user can start the complete application from the repository root and receives a specific fix for every missing prerequisite.

### 6. Create `START-HERE.md` in Portuguese

The guide should be task-oriented rather than architecture-oriented.

Recommended structure:

1. What this tool does
2. What it costs and which external accounts are required
3. Install Node
4. Create the Neon database
5. Apply the database schema with an exact command
6. Create Anthropic and Firecrawl keys
7. Copy and complete the environment files
8. Run `npm run doctor`
9. Run `npm run dev`
10. Create the first benchmark
11. Troubleshooting by visible error message
12. How to stop the services and protect API keys

Include expected output and screenshots for the diagnostic and first-run steps.

**Acceptance check:** A user unfamiliar with the repository can complete setup without reading source code or combining instructions from several files.

### 7. Add a pre-run confirmation

**Current friction:** Pressing the button immediately starts paid work.

**Short-term action:**

- Replace the free-text ISO country input with a country selector.
- Show the providers that will be called.
- Show a conservative duration range.
- Explain that the run consumes paid API credits.
- Ask for confirmation immediately before starting.

Do not invent an exact monetary estimate unless it is calculated from real usage. A clear paid-credit warning is better than a misleading number.

**Acceptance check:** Users understand that the operation is paid before any provider request is sent.

### 8. Replace raw errors with recovery instructions

**Current problem:** Failed runs expose parser and stack errors, while the interface can continue to say discovery is in progress.

**Short-term action:**

- Map known failures to plain-language messages.
- Hide stack traces and raw provider responses from the user interface.
- Provide one recommended next action for each error.
- Never show progress copy after a run reaches a failed state.
- Keep technical details in server logs for debugging.

**Acceptance check:** A failed screen contains a plain explanation, one recovery action, and no raw stack trace.

### 9. Restore the quality baseline

**Short-term action:**

- Upgrade Next.js to the available patched release after checking its release notes.
- Repair the ESLint configuration so `npm run lint` executes successfully.
- Add root scripts for `lint`, `test`, and `build`.
- Add CI that runs these commands on every pull request.

**Acceptance check:** A clean clone passes install, lint, tests, and production builds through documented root commands.

### 10. Add three critical smoke tests

Keep the initial suite deliberately small:

1. Unauthorized requests cannot trigger paid work.
2. A total discovery-provider failure produces a failed run.
3. Unsafe generated Markdown is sanitized before rendering.

**Acceptance check:** All three tests fail against the unsafe behavior and pass after the quick-win fixes.

## Suggested two-day sequence

### Day 1: Make it safe and truthful

1. Sanitize generated Markdown.
2. Add the access gate.
3. Correct failure status handling.
4. Make retry IDs unique.
5. Add the three regression tests.

### Day 2: Make it usable

1. Add root `dev`, `doctor`, `lint`, `test`, and `build` commands.
2. Write `START-HERE.md` in Portuguese.
3. Add the pre-run confirmation.
4. Improve failed-run messages and retry controls.
5. Patch Next.js and run the complete clean-install check.

## Explicitly defer

These improvements are valuable, but they are not quick wins and should not delay the first limited release:

- Durable external job queue
- Pipeline checkpointing and automatic resume
- Multi-user accounts and permissions
- Full database redesign
- Complete run-scoped data model
- Usage metering and billing
- Automated deployment for every recipient
- Large end-to-end test suite
- Major visual redesign

The short-term release should be presented honestly as a local, single-user tool. A later version can become a hosted product after the workflow has been validated with real users.

## Release recommendation

After the quick wins, release first to 5 to 10 technically curious followers rather than the full audience.

Observe:

- Percentage who complete setup
- Time from clone to first run
- Number of times Pedro must intervene
- Provider and parsing failure rate
- Percentage who reach a useful completed report

Proceed to a broad giveaway only when most pilot users complete their first benchmark without direct assistance.
