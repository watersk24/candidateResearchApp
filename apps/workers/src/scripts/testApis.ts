/**
 * Smoke-tests all external API clients with real names.
 * Run: node --env-file=.env --import tsx/esm apps/workers/src/scripts/testApis.ts
 */

import {
  findMemberByName,
  getHouseVoteList,
  getHouseVoteMemberPositions,
  getCurrentCongressSession,
} from "../lib/congress.js";
import { searchCandidate, getCandidateTotals } from "../lib/fec.js";
import { searchArticles, extractDomain } from "../lib/newsapi.js";

const TEST_HOUSE_MEMBER = "Chuck Fleischmann"; // active House member, TN-3
const TEST_FEC_CANDIDATE = "Nancy Pelosi";
const TEST_NEWS_QUERY = "Marco Rubio";

let passed = 0;
let failed = 0;

function pass(label: string, detail?: string) {
  console.log(`  ✓ ${label}${detail ? `: ${detail}` : ""}`);
  passed++;
}

function fail(label: string, err: unknown) {
  console.error(`  ✗ ${label}: ${(err as Error).message ?? err}`);
  failed++;
}

// ── Congress.gov — member lookup + House vote history ─────────────────────────
console.log("\n[Congress.gov]");

try {
  const member = await findMemberByName(TEST_HOUSE_MEMBER, "house");
  if (!member) {
    fail("findMemberByName", new Error(`No member found for "${TEST_HOUSE_MEMBER}"`));
  } else {
    pass("findMemberByName", `${member.name} (${member.bioguideId})`);

    const { congress, session } = getCurrentCongressSession();
    pass("getCurrentCongressSession", `${congress}th Congress, session ${session}`);

    const voteList = await getHouseVoteList(congress, session, 5);
    if (voteList.length === 0) {
      fail("getHouseVoteList", new Error("0 votes returned"));
    } else {
      pass("getHouseVoteList", `${voteList.length} votes (most recent: roll ${voteList[0].rollCallNumber} on ${voteList[0].startDate.split("T")[0]})`);

      // Check member positions on the most recent vote
      const positions = await getHouseVoteMemberPositions(
        congress,
        session,
        voteList[0].rollCallNumber
      );
      const memberPos = positions.find(
        (p) => p.bioguideID.toUpperCase() === member.bioguideId.toUpperCase()
      );

      if (positions.length === 0) {
        fail("getHouseVoteMemberPositions", new Error("0 member positions returned"));
      } else {
        pass(
          "getHouseVoteMemberPositions",
          `${positions.length} members — ${TEST_HOUSE_MEMBER} voted: ${memberPos?.voteCast ?? "not found in results"}`
        );
      }
    }
  }
} catch (err) {
  fail("Congress.gov", err);
}

// ── FEC ───────────────────────────────────────────────────────────────────────
console.log("\n[FEC]");

try {
  const candidate = await searchCandidate(TEST_FEC_CANDIDATE, "H");
  if (!candidate) {
    fail("searchCandidate", new Error(`No candidate found for "${TEST_FEC_CANDIDATE}"`));
  } else {
    pass("searchCandidate", `${candidate.name} (${candidate.candidate_id})`);

    const totals = await getCandidateTotals(candidate.candidate_id);
    if (totals.length === 0) {
      fail("getCandidateTotals", new Error("0 cycles returned"));
    } else {
      const t = totals[0];
      pass(
        "getCandidateTotals",
        `${totals.length} cycle(s) — raised $${t.receipts?.toLocaleString()}`
      );
    }
  }
} catch (err) {
  fail("FEC", err);
}

// ── NewsAPI ───────────────────────────────────────────────────────────────────
console.log("\n[NewsAPI]");

try {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const fromDate = thirtyDaysAgo.toISOString().split("T")[0];

  const articles = await searchArticles(TEST_NEWS_QUERY, fromDate, 10);
  if (articles.length === 0) {
    fail("searchArticles", new Error(`0 articles for "${TEST_NEWS_QUERY}"`));
  } else {
    pass("searchArticles", `${articles.length} articles`);
    const withDomain = articles.filter((a) => extractDomain(a.url));
    pass("extractDomain", `${withDomain.length}/${articles.length} have parseable domains`);
    const sample = articles[0];
    console.log(`    sample: "${sample.title}" — ${sample.source.name} (${extractDomain(sample.url)})`);
  }
} catch (err) {
  fail("NewsAPI", err);
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} checks — ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
