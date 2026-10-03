/**
 * Imports races and candidates from a data provider into the database (ADR-008).
 *
 * Usage:
 *   node --env-file=.env --import tsx/esm apps/workers/src/scripts/ingestRaces.ts <provider> <YYYY-MM-DD> [--force]
 *
 * Example:
 *   node --env-file=.env --import tsx/esm apps/workers/src/scripts/ingestRaces.ts ncsbe 2026-11-03
 *
 * --force allows withdrawing more than 10% of the date's candidates in one run
 * (the run stops otherwise, since that usually means a truncated source file).
 *
 * Does not enqueue enrichment scrapers; use triggerJob.ts for that.
 */

import { prisma } from "../lib/db.js";
import { ingestRaces } from "../ingest/ingestRaces.js";
import { ncsbeProvider } from "../ingest/providers/ncsbe.js";
import type { RaceDataProvider } from "../ingest/types.js";

const PROVIDERS: Record<string, RaceDataProvider> = {
  ncsbe: ncsbeProvider,
};

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const [providerArg, electionDate] = args.filter((a) => a !== "--force");
  const provider = providerArg ? PROVIDERS[providerArg] : undefined;

  const validDate =
    !!electionDate &&
    /^\d{4}-\d{2}-\d{2}$/.test(electionDate) &&
    !Number.isNaN(Date.parse(electionDate)) &&
    new Date(electionDate).toISOString().slice(0, 10) === electionDate; // rejects 2026-02-31

  if (!provider || !validDate) {
    console.error(
      `Usage: ingestRaces.ts <provider> <YYYY-MM-DD> [--force]\nProviders: ${Object.keys(PROVIDERS).join(", ")}`
    );
    process.exit(1);
  }

  console.log(`Ingesting ${provider.source} races for ${electionDate}${force ? " (--force)" : ""}...`);
  const stats = await ingestRaces(provider, { electionDate }, new Date(), { force });

  console.log(`  races:                ${stats.races}`);
  console.log(`  candidates created:   ${stats.candidatesCreated}`);
  console.log(`  candidates updated:   ${stats.candidatesUpdated}`);
  console.log(`  candidates withdrawn: ${stats.candidatesWithdrawn}`);
  console.log(`  elections retired:    ${stats.electionsRetired}`);
  console.log(`  malformed rows skipped: ${stats.skippedRows}`);
  console.log(`  unmatched contests:   ${stats.unmatchedContests.length} (not yet supported; see ADR-008)`);
  for (const contest of stats.unmatchedContests) {
    console.log(`    - ${contest}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
