/**
 * Manual job trigger for local testing.
 *
 * Usage:
 *   tsx apps/workers/src/scripts/triggerJob.ts <jobType> [candidateId]
 *
 * If no candidateId is given, enqueues the job for all candidates in the DB.
 *
 * Examples:
 *   tsx apps/workers/src/scripts/triggerJob.ts full_refresh
 *   tsx apps/workers/src/scripts/triggerJob.ts voting_record abc123
 */

import { PrismaClient } from "@prisma/client";
import { createScrapeQueue } from "../queues/scrapeQueue.js";
import type { ScrapeJobData } from "../queues/scrapeQueue.js";

const VALID_JOB_TYPES: ScrapeJobData["jobType"][] = [
  "voting_record",
  "campaign_finance",
  "news_sentiment",
  "full_refresh",
];

async function main() {
  const [, , jobTypeArg, candidateIdArg] = process.argv;

  if (!jobTypeArg || !VALID_JOB_TYPES.includes(jobTypeArg as ScrapeJobData["jobType"])) {
    console.error(
      `Usage: tsx triggerJob.ts <jobType> [candidateId]\nValid job types: ${VALID_JOB_TYPES.join(", ")}`
    );
    process.exit(1);
  }

  const jobType = jobTypeArg as ScrapeJobData["jobType"];
  const prisma = new PrismaClient();
  const queue = createScrapeQueue();

  let candidateIds: string[];

  if (candidateIdArg) {
    candidateIds = [candidateIdArg];
  } else {
    const candidates = await prisma.candidate.findMany({ select: { id: true, fullName: true } });
    candidateIds = candidates.map((c) => c.id);
    console.log(`Found ${candidates.length} candidates:`);
    for (const c of candidates) {
      console.log(`  ${c.id}  ${c.fullName}`);
    }
  }

  console.log(`\nEnqueueing ${jobType} for ${candidateIds.length} candidate(s)...`);

  for (const candidateId of candidateIds) {
    await queue.add(jobType, { candidateId, jobType });
    console.log(`  ✓ queued ${candidateId}`);
  }

  await prisma.$disconnect();
  await queue.close();
  console.log("\nDone. Start the workers with: npm run dev:workers");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
