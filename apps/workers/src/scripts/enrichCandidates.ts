/**
 * Enriches federal candidates for an election date (ADR-008 Slice 4):
 *   1. links each to its FEC candidate ID within its own race, and
 *   2. stores campaign finance totals for linked candidates.
 *
 * Runs scrapers directly, without the BullMQ queue, so it needs no Redis, and
 * can run as a Cloud Run Job after the daily race import.
 *
 * Usage:
 *   node --env-file=.env --import tsx/esm apps/workers/src/scripts/enrichCandidates.ts <YYYY-MM-DD>
 *
 * Exits non-zero if any race or candidate fails, so the job's failure alert fires.
 */

import { prisma } from "../lib/db.js";
import { linkFecIds } from "../enrich/linkFec.js";
import { scrapeCampaignFinance } from "../scrapers/campaignFinance.js";

const PACE_MS = 1_000;

async function main() {
  const electionDate = process.argv[2];
  const validDate =
    !!electionDate &&
    /^\d{4}-\d{2}-\d{2}$/.test(electionDate) &&
    !Number.isNaN(Date.parse(electionDate)) &&
    new Date(electionDate).toISOString().slice(0, 10) === electionDate;

  if (!validDate) {
    console.error("Usage: enrichCandidates.ts <YYYY-MM-DD>");
    process.exit(1);
  }

  console.log(`Linking FEC IDs for ${electionDate}...`);
  const link = await linkFecIds(electionDate);
  console.log(`  races:          ${link.races}`);
  console.log(`  newly linked:   ${link.linked}`);
  console.log(`  already linked: ${link.alreadyLinked}`);
  const lists: [string, string[]][] = [
    ["unlinked (stale)", link.unlinkedStale],
    ["unmatched", link.unmatched],
    ["needs confirmation (add to fecConfirmedLinks.ts after checking)", link.needsConfirmation],
    ["ambiguous", link.ambiguous],
    ["failed races", link.failedRaces],
  ];
  for (const [title, items] of lists) {
    console.log(`  ${title}: ${items.length}`);
    for (const item of items) console.log(`    - ${item}`);
  }

  const candidates = await prisma.candidate.findMany({
    where: {
      status: "active",
      election: {
        electionDate: new Date(electionDate),
        status: { in: ["upcoming", "active"] },
        district: { level: "federal" },
      },
    },
    select: { id: true, fullName: true },
  });

  console.log(`Campaign finance for ${candidates.length} federal candidates...`);
  let failed = 0;
  for (const candidate of candidates) {
    // Pace requests; the FEC throttles bursts (fec.ts also retries on 429)
    await new Promise((resolve) => setTimeout(resolve, PACE_MS));
    try {
      await scrapeCampaignFinance(candidate.id);
    } catch (err) {
      failed++;
      // Message only: axios errors carry the request config, including the API key
      console.error(
        `  campaign finance failed for "${candidate.fullName}": ${err instanceof Error ? err.message : "unknown error"}`
      );
    }
  }
  console.log(`  failed: ${failed}`);
  if (failed > 0 || link.failedRaces.length > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
