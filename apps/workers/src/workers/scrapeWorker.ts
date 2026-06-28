import { Worker } from "bullmq";
import { redis } from "../lib/redis.js";
import type { ScrapeJobData } from "../queues/scrapeQueue.js";

export function registerScrapeWorker() {
  return new Worker<ScrapeJobData>(
    "candidate-scrape",
    async (job) => {
      const { candidateId, jobType } = job.data;
      console.log(`Processing ${jobType} for candidate ${candidateId}`);

      // TODO: implement per-job-type scrapers
      switch (jobType) {
        case "voting_record":
          // await scrapeVotingRecord(candidateId);
          break;
        case "campaign_finance":
          // await scrapeCampaignFinance(candidateId);
          break;
        case "news_sentiment":
          // await scrapeNewsSentiment(candidateId);
          break;
        case "full_refresh":
          // await scrapeFullRefresh(candidateId);
          break;
      }
    },
    {
      connection: redis,
      concurrency: 5,
      limiter: { max: 10, duration: 1000 },
    }
  );
}
