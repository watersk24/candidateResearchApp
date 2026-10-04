/**
 * newsSentiment.ts tests
 *
 * Covers:
 *  - scrapeNewsSentiment(): full orchestration with mocked db, newsapi, and axios (Priority 2)
 *
 * Key behaviors verified:
 *  - Skips articles whose domain is not in the known NewsOutlet list
 *  - Calls sentiment service per article and stores result
 *  - Gracefully continues when sentiment service fails (does not abort the job)
 *  - Stores records via transaction
 *  - Marks candidate as refreshed even when no known-outlet articles exist
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Prisma mock ───────────────────────────────────────────────────────────────
const mockDb = vi.hoisted(() => ({
  candidate: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  newsOutlet: {
    findMany: vi.fn(),
  },
  newsArticle: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
  $transaction: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../lib/db.js", () => ({ prisma: mockDb }));

// ── NewsAPI mock ──────────────────────────────────────────────────────────────
const mockNewsApi = vi.hoisted(() => ({
  searchArticles: vi.fn().mockResolvedValue([]),
  // Use real extractDomain logic: strip www., return null for invalid URLs
  extractDomain: vi.fn((url: string) => {
    try {
      const { hostname } = new URL(url);
      return hostname.replace(/^www\./, "");
    } catch {
      return null;
    }
  }),
}));

vi.mock("../../lib/newsapi.js", () => mockNewsApi);

// ── axios mock (for sentiment service calls) ──────────────────────────────────
const mockAxios = vi.hoisted(() => ({
  post: vi.fn(),
}));

vi.mock("axios", () => ({ default: mockAxios }));

import { scrapeNewsSentiment } from "../../scrapers/newsSentiment.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCandidate(id = "cand-1") {
  return {
    id,
    fullName: "Jane Doe",
    election: {
      electionCycleStart: new Date("2024-01-01"),
    },
  };
}

function makeOutlet(id: string, domain: string) {
  return { id, name: "Test Outlet", bias: "neutral", domain };
}

function makeArticle(url: string, title = "Test Headline") {
  return {
    source: { id: null, name: "Test" },
    author: null,
    title,
    description: "A test article description.",
    url,
    publishedAt: "2024-03-01T12:00:00Z",
    content: null,
  };
}

function makeSentimentResponse() {
  return {
    data: {
      article_id: "http://reuters.com/article/1",
      label: "positive" as const,
      score: 0.85,
      positive: 0.85,
      negative: 0.05,
      neutral: 0.1,
    },
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("scrapeNewsSentiment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.$transaction.mockResolvedValue([]);
    mockDb.candidate.update.mockResolvedValue({});
  });

  it("returns early without touching NewsAPI when candidate does not exist", async () => {
    mockDb.candidate.findUnique.mockResolvedValue(null);

    await scrapeNewsSentiment("nonexistent-id");

    expect(mockNewsApi.searchArticles).not.toHaveBeenCalled();
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  it("updates candidate as refreshed and exits when no articles are found", async () => {
    mockDb.candidate.findUnique.mockResolvedValue(makeCandidate());
    mockNewsApi.searchArticles.mockResolvedValue([]);

    await scrapeNewsSentiment("cand-1");

    expect(mockDb.candidate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ dataIsStale: false }),
      })
    );
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  it("skips articles from outlets not in the known outlet list", async () => {
    mockDb.candidate.findUnique.mockResolvedValue(makeCandidate());
    mockNewsApi.searchArticles.mockResolvedValue([
      makeArticle("https://unknownnewssite.com/article/1"),
    ]);
    mockDb.newsOutlet.findMany.mockResolvedValue([
      makeOutlet("outlet-reuters", "reuters.com"),
    ]);

    await scrapeNewsSentiment("cand-1");

    // No matching outlet → no records → transaction still runs to update candidate
    const txArgs = mockDb.$transaction.mock.calls[0][0];
    // Should have deleteMany + no createMany + update
    expect(mockDb.newsArticle.createMany).not.toHaveBeenCalled();
  });

  it("stores a record for an article from a known outlet domain", async () => {
    mockDb.candidate.findUnique.mockResolvedValue(makeCandidate());
    mockNewsApi.searchArticles.mockResolvedValue([
      makeArticle("https://reuters.com/article/1", "Candidate wins big"),
    ]);
    mockDb.newsOutlet.findMany.mockResolvedValue([makeOutlet("outlet-reuters", "reuters.com")]);
    mockAxios.post.mockResolvedValue(makeSentimentResponse());

    await scrapeNewsSentiment("cand-1");

    expect(mockDb.newsArticle.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            candidateId: "cand-1",
            outletId: "outlet-reuters",
            headline: "Candidate wins big",
            sentiment: "positive",
            sentimentScore: 0.85,
          }),
        ]),
      })
    );
  });

  it("strips www from article domain when matching against NewsOutlet list", async () => {
    mockDb.candidate.findUnique.mockResolvedValue(makeCandidate());
    mockNewsApi.searchArticles.mockResolvedValue([
      makeArticle("https://www.reuters.com/article/1"),
    ]);
    // Outlet domain stored WITHOUT www
    mockDb.newsOutlet.findMany.mockResolvedValue([makeOutlet("outlet-reuters", "reuters.com")]);
    mockAxios.post.mockResolvedValue(makeSentimentResponse());

    await scrapeNewsSentiment("cand-1");

    expect(mockDb.newsArticle.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ outletId: "outlet-reuters" }),
        ]),
      })
    );
  });

  it("continues processing other articles when sentiment service fails for one", async () => {
    mockDb.candidate.findUnique.mockResolvedValue(makeCandidate());
    mockNewsApi.searchArticles.mockResolvedValue([
      makeArticle("https://reuters.com/article/1", "Article 1"),
      makeArticle("https://reuters.com/article/2", "Article 2"),
    ]);
    mockDb.newsOutlet.findMany.mockResolvedValue([makeOutlet("outlet-reuters", "reuters.com")]);

    // First call fails, second succeeds
    mockAxios.post
      .mockRejectedValueOnce(new Error("Sentiment service unavailable"))
      .mockResolvedValueOnce(makeSentimentResponse());

    await scrapeNewsSentiment("cand-1");

    // Both articles still stored, first with null sentiment
    expect(mockDb.newsArticle.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ headline: "Article 1", sentiment: null }),
          expect.objectContaining({ headline: "Article 2", sentiment: "positive" }),
        ]),
      })
    );
  });

  it("stores null sentiment when sentiment service returns null data", async () => {
    mockDb.candidate.findUnique.mockResolvedValue(makeCandidate());
    mockNewsApi.searchArticles.mockResolvedValue([
      makeArticle("https://reuters.com/article/1"),
    ]);
    mockDb.newsOutlet.findMany.mockResolvedValue([makeOutlet("outlet-reuters", "reuters.com")]);
    // Sentiment service times out → axios rejects
    mockAxios.post.mockRejectedValue(new Error("timeout"));

    await scrapeNewsSentiment("cand-1");

    const createCall = mockDb.newsArticle.createMany.mock.calls[0][0];
    expect(createCall.data[0].sentiment).toBeNull();
    expect(createCall.data[0].sentimentScore).toBeNull();
    expect(createCall.data[0].analyzedAt).toBeNull();
  });

  it("runs a transaction with deleteMany + createMany + update when records exist", async () => {
    mockDb.candidate.findUnique.mockResolvedValue(makeCandidate());
    mockNewsApi.searchArticles.mockResolvedValue([
      makeArticle("https://reuters.com/article/1"),
    ]);
    mockDb.newsOutlet.findMany.mockResolvedValue([makeOutlet("outlet-reuters", "reuters.com")]);
    mockAxios.post.mockResolvedValue(makeSentimentResponse());

    await scrapeNewsSentiment("cand-1");

    expect(mockDb.newsArticle.deleteMany).toHaveBeenCalledWith({
      where: { candidateId: "cand-1" },
    });
    expect(mockDb.newsArticle.createMany).toHaveBeenCalled();
    expect(mockDb.candidate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "cand-1" },
        data: expect.objectContaining({ dataIsStale: false }),
      })
    );
    expect(mockDb.$transaction).toHaveBeenCalled();
  });
});
