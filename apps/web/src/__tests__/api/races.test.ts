/**
 * GET /api/races tests
 *
 * Covers:
 *  - Returns 400 when districtIds is missing or empty
 *  - Returns grouped elections for valid district IDs
 *  - Only returns upcoming and active elections
 *  - Excludes withdrawn candidates
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Prisma mock ───────────────────────────────────────────────────────────────
const mockDb = vi.hoisted(() => ({
  election: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));

import { GET } from "@/app/api/races/route";
import { NextRequest } from "next/server";

// ── Helper ────────────────────────────────────────────────────────────────────
function makeRequest(queryString: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api/races?${queryString}`);
}

function makeElection(districtId: string, overrides: Record<string, unknown> = {}) {
  return {
    id: `election-${districtId}`,
    name: `${districtId} General 2026`,
    electionType: "general",
    electionDate: new Date("2026-11-03"),
    status: "upcoming",
    districtId,
    district: {
      id: districtId,
      name: `District ${districtId}`,
      level: "federal",
      districtType: "Congressional District",
      jurisdiction: {
        id: "jur-1",
        name: "Tennessee",
        type: "state",
      },
    },
    candidates: [
      {
        id: "cand-1",
        fullName: "Jane Doe",
        party: "Democratic",
        status: "active",
        isIncumbent: false,
        profileSlug: "jane-doe",
        ratings: null,
      },
    ],
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("GET /api/races", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when districtIds query parameter is missing", async () => {
    const response = await GET(makeRequest(""));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/districtIds/);
  });

  it("returns 400 when districtIds is an empty string", async () => {
    const response = await GET(makeRequest("districtIds="));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/districtIds/);
  });

  it("returns 200 with elections when valid districtIds are provided", async () => {
    const election = makeElection("district-1");
    mockDb.election.findMany.mockResolvedValue([election]);

    const response = await GET(makeRequest("districtIds=district-1"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.elections).toHaveLength(1);
    expect(body.elections[0].id).toBe("election-district-1");
  });

  it("returns elections for multiple district IDs (comma-separated)", async () => {
    const elections = [makeElection("district-1"), makeElection("district-2")];
    mockDb.election.findMany.mockResolvedValue(elections);

    const response = await GET(makeRequest("districtIds=district-1,district-2"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.elections).toHaveLength(2);
  });

  it("queries Prisma with the district IDs from the request", async () => {
    mockDb.election.findMany.mockResolvedValue([]);

    await GET(makeRequest("districtIds=d-1,d-2,d-3"));

    expect(mockDb.election.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          districtId: { in: ["d-1", "d-2", "d-3"] },
        }),
      })
    );
  });

  it("filters to only upcoming and active election statuses", async () => {
    mockDb.election.findMany.mockResolvedValue([]);

    await GET(makeRequest("districtIds=district-1"));

    expect(mockDb.election.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ["upcoming", "active"] },
        }),
      })
    );
  });

  it("excludes withdrawn candidates from results", async () => {
    mockDb.election.findMany.mockResolvedValue([]);

    await GET(makeRequest("districtIds=district-1"));

    const query = mockDb.election.findMany.mock.calls[0][0];
    expect(query.include.candidates.where).toMatchObject({
      status: { not: "withdrawn" },
    });
  });

  it("includes district and jurisdiction in the response", async () => {
    mockDb.election.findMany.mockResolvedValue([makeElection("district-1")]);

    const response = await GET(makeRequest("districtIds=district-1"));
    const body = await response.json();

    expect(body.elections[0].district).toBeDefined();
    expect(body.elections[0].district.jurisdiction).toBeDefined();
  });

  it("returns an empty elections array when no matching elections exist", async () => {
    mockDb.election.findMany.mockResolvedValue([]);

    const response = await GET(makeRequest("districtIds=nonexistent-district"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.elections).toEqual([]);
  });
});
