import express from "express";
import { createScrapeJob, updateScrapeJob } from "./queries.js";
import { scrapeAdLibrary } from "./scrape.js";

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

const port = parseInt(process.env.PORT ?? "3002", 10);
app.listen(port, () => console.log(`worker listening on ${port}`));
