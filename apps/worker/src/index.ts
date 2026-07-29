import express from "express";
import {
  createScrapeJob,
  updateScrapeJob,
  findCachedRun,
  createRun,
  updateRun,
  makeRunId,
  normalizeNicheKey,
} from "./queries.js";
import { scrapeAdLibrary } from "./scrape.js";
import { runDiscoveryPipeline } from "./run.js";

const app = express();
app.use(express.json());

const WORKER_SECRET = process.env.WORKER_SECRET;
if (!WORKER_SECRET) {
  throw new Error("WORKER_SECRET must be set — refusing to start with auth disabled");
}

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/scrape", async (req, res) => {
  if (req.headers["x-worker-secret"] !== WORKER_SECRET) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { competitorId, pageHandle, country } = req.body as {
    competitorId: string;
    pageHandle: string;
    country?: string;
  };

  if (!competitorId || !pageHandle) {
    res.status(400).json({ error: "competitorId and pageHandle are required" });
    return;
  }

  const jobId = await createScrapeJob(competitorId, "manual", `worker-${Date.now()}`);

  // Respond immediately so the caller isn't waiting
  res.json({ ok: true, jobId });

  // Run scrape async after response
  try {
    await updateScrapeJob(jobId, "running");
    const result = await scrapeAdLibrary({ competitorId, pageHandle, country });

    if (result.error) {
      await updateScrapeJob(
        jobId,
        result.adsUpserted > 0 ? "partial" : "failed",
        { meta_ad_library: result.adsUpserted },
        { meta_ad_library: result.error }
      );
    } else {
      await updateScrapeJob(jobId, "ok", { meta_ad_library: result.adsUpserted });
    }
  } catch (err) {
    await updateScrapeJob(jobId, "failed", undefined, {
      meta_ad_library: String(err),
    }).catch(() => {});
  }
});

app.post("/run", async (req, res) => {
  if (req.headers["x-worker-secret"] !== WORKER_SECRET) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { nicheLabel, country } = req.body as { nicheLabel?: string; country?: string };
  if (!nicheLabel || !country) {
    res.status(400).json({ error: "nicheLabel and country are required" });
    return;
  }

  const nicheKey = normalizeNicheKey(nicheLabel);
  const cacheDays = parseInt(process.env.RUN_CACHE_DAYS ?? "14", 10);
  const cached = await findCachedRun(nicheKey, country, cacheDays);
  if (cached) {
    res.json({ ok: true, runId: cached.id, cached: true });
    return;
  }

  const runId = makeRunId(nicheLabel, country);
  await createRun(runId, nicheLabel, nicheKey, country);

  // Respond immediately, same fire-and-forget pattern as /scrape — the
  // caller polls run status instead of waiting on this request.
  res.json({ ok: true, runId, cached: false });

  runDiscoveryPipeline(runId, nicheLabel, country).catch(async (err) => {
    console.error(`run ${runId} failed:`, err);
    await updateRun(runId, { status: "failed", error: String(err), finished: true }).catch(
      () => {}
    );
  });
});

const port = parseInt(process.env.PORT ?? "3002", 10);
app.listen(port, () => console.log(`worker listening on ${port}`));
