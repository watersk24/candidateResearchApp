import { Worker } from "bullmq";
import { bullmqConnection } from "../lib/redis.js";
import type { ScrapeJobData } from "../queues/scrapeQueue.js";
import { scrapeVotingRecord } from "../scrapers/votingRecord.js";
import { scrapeCampaignFinance } from "../scrapers/campaignFinance.js";
import { scrapeNewsSentiment } from "../scrapers/newsSentiment.js";
import { computeRatings } from "../scrapers/computeRatings.js";

export function registerScrapeWorker() {
  return new Worker<ScrapeJobData>(
    "candidate-scrape",
    async (job) => {
      const { candidateId, jobType } = job.data;
      console.log(`[worker] ${jobType} for candidate ${candidateId}`);

      switch (jobType) {
        case "voting_record":
          await scrapeVotingRecord(candidateId);
          break;
        case "campaign_finance":
          await scrapeCampaignFinance(candidateId);
          break;
        case "news_sentiment":
          await scrapeNewsSentiment(candidateId);
          break;
        case "compute_ratings":
          await computeRatings(candidateId);
          break;
        case "full_refresh":
          await scrapeVotingRecord(candidateId);
          await scrapeCampaignFinance(candidateId);
          await scrapeNewsSentiment(candidateId);
          await computeRatings(candidateId);
          break;
      }
    },
    {
      connection: bullmqConnection,
      concurrency: 5,
      limiter: { max: 10, duration: 1000 },
    }
  );
}
