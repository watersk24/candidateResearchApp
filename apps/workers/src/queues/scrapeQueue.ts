import { Queue } from "bullmq";
import { redis } from "../lib/redis.js";

export type ScrapeJobData = {
  candidateId: string;
  jobType: "voting_record" | "campaign_finance" | "news_sentiment" | "full_refresh";
};

export function createScrapeQueue() {
  return new Queue<ScrapeJobData>("candidate-scrape", {
    connection: redis,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 500 },
    },
  });
}
