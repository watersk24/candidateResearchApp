import { createScrapeQueue } from "./queues/scrapeQueue.js";
import { registerScrapeWorker } from "./workers/scrapeWorker.js";

async function main() {
  console.log("Starting candidate research workers...");

  const queue = createScrapeQueue();
  const worker = registerScrapeWorker();

  worker.on("completed", (job) => {
    console.log(`Job ${job.id} completed: ${job.name}`);
  });

  worker.on("failed", (job, err) => {
    console.error(`Job ${job?.id} failed: ${err.message}`);
  });

  console.log("Workers running. Waiting for jobs...");
}

main().catch((err) => {
  console.error("Worker startup failed:", err);
  process.exit(1);
});
