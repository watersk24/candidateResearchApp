/**
 * GET /api/candidates/[slug] tests
 *
 * Covers:
 *  - Returns 404 when slug is not found in DB
 *  - Returns full candidate profile when slug exists
 *  - Passes the correct query to Prisma (includes all related records)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Prisma mock ───────────────────────────────────────────────────────────────
const mockDb = vi.hoisted(() => ({
  candidate: {
    findUnique: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));

import { GET } from "@/app/api/candidates/[slug]/route";
import { NextRequest } from "next/server";

// ── Helper ────────────────────────────────────────────────────────────────────
function makeRequest(slug: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api/candidates/${slug}`);
}

function makeParams(slug: string) {
  return { params: Promise.resolve({ slug }) };
}

/** Minimal candidate shape that satisfies the Prisma include */
function makeFullCandidate(slug = "jane-doe-tn-09") {
  return {
    id: "cand-1",
    fullName: "Jane Doe",
    party: "Democratic",
    status: "active",
    isIncumbent: false,
    profileSlug: slug,
    officialWebsiteUrl: null,
    lastRefreshedAt: null,
    dataIsStale: false,
    hasLimitedData: false,
    election: {
      id: "election-1",
      name: "TN-09 General 2026",
      electionType: "general",
      electionDate: new Date("2026-11-03"),
      status: "upcoming",
      district: {
        id: "district-1",
        name: "TN Congressional District 9",
        level: "federal",
        districtType: "Congressional District",
        jurisdiction: {
          id: "jur-1",
          name: "Tennessee",
          type: "state",
        },
      },
    },
    votingRecords: [],
    campaignFinanceRecords: [],
    publicStatements: [],
    legalHistory: [],
    businessAffiliations: [],
    newsArticles: [],
    ratings: null,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("GET /api/candidates/[slug]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 with an error message when slug is not found", async () => {
    mockDb.candidate.findUnique.mockResolvedValue(null);

    const response = await GET(makeRequest("unknown-slug"), makeParams("unknown-slug"));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Candidate not found");
  });

  it("returns 200 with the candidate when slug is found", async () => {
    const candidate = makeFullCandidate("jane-doe-tn-09");
    mockDb.candidate.findUnique.mockResolvedValue(candidate);

    const response = await GET(makeRequest("jane-doe-tn-09"), makeParams("jane-doe-tn-09"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.candidate.fullName).toBe("Jane Doe");
    expect(body.candidate.profileSlug).toBe("jane-doe-tn-09");
  });

  it("queries Prisma by profileSlug", async () => {
    mockDb.candidate.findUnique.mockResolvedValue(null);

    await GET(makeRequest("test-slug"), makeParams("test-slug"));

    expect(mockDb.candidate.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { profileSlug: "test-slug" },
      })
    );
  });

  it("includes all required relations in the Prisma query", async () => {
    mockDb.candidate.findUnique.mockResolvedValue(null);

    await GET(makeRequest("test-slug"), makeParams("test-slug"));

    const query = mockDb.candidate.findUnique.mock.calls[0][0];
    const include = query.include;

    expect(include).toHaveProperty("election");
    expect(include).toHaveProperty("votingRecords");
    expect(include).toHaveProperty("campaignFinanceRecords");
    expect(include).toHaveProperty("publicStatements");
    expect(include).toHaveProperty("legalHistory");
    expect(include).toHaveProperty("businessAffiliations");
    expect(include).toHaveProperty("newsArticles");
    expect(include).toHaveProperty("ratings");
  });

  it("returns the complete candidate object in the response body", async () => {
    const candidate = makeFullCandidate("test-slug");
    candidate.ratings = {
      id: "ratings-1",
      candidateId: "cand-1",
      transparencyScore: 75,
      transparencyVotingPct: 80,
      transparencyFinancePct: 90,
      transparencyStatementPct: 60,
      transparencyLegalPct: 70,
      sentimentConservative: 0.3,
      sentimentLiberal: 0.6,
      sentimentNeutral: 0.1,
      sentimentArticleCount: 42,
      factualConsistencyScore: null,
      attendanceScore: null,
      complianceScore: null,
      positionDocScore: null,
      campaignFinanceScore: null,
      dataStatus: "limited",
      computedAt: new Date("2025-01-01"),
      updatedAt: new Date("2025-01-01"),
    } as any;

    mockDb.candidate.findUnique.mockResolvedValue(candidate);

    const response = await GET(makeRequest("test-slug"), makeParams("test-slug"));
    const body = await response.json();

    expect(body.candidate.ratings).toBeDefined();
    expect(body.candidate.ratings.transparencyScore).toBe(75);
  });
});
