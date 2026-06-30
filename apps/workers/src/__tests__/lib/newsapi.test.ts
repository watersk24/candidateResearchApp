/**
 * newsapi.ts tests
 *
 * Covers:
 *  - extractDomain(): pure URL parsing (Priority 1 — no mocks needed)
 *  - searchArticles(): mocked axios (Priority 2)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── axios mock ────────────────────────────────────────────────────────────────
// Must be declared with vi.hoisted so the factory can reference them.
const axiosMocks = vi.hoisted(() => ({
  get: vi.fn(),
  create: vi.fn(),
}));

vi.mock("axios", () => ({
  default: {
    create: axiosMocks.create,
  },
}));

// ── imports (resolved after mocks are set up) ─────────────────────────────────
import { extractDomain, searchArticles } from "../../lib/newsapi.js";

// ── extractDomain — pure function, no mocks needed ───────────────────────────
describe("extractDomain", () => {
  it("returns the hostname from a valid URL", () => {
    expect(extractDomain("https://www.reuters.com/article/foo")).toBe("reuters.com");
  });

  it("strips www. prefix", () => {
    expect(extractDomain("https://www.nytimes.com/2024/01/01/politics/foo.html")).toBe(
      "nytimes.com"
    );
  });

  it("returns hostname unchanged when no www. prefix", () => {
    expect(extractDomain("https://apnews.com/article/bar")).toBe("apnews.com");
  });

  it("handles URLs with paths, query strings, and fragments", () => {
    expect(extractDomain("https://foxnews.com/politics/article?utm_source=google#section")).toBe(
      "foxnews.com"
    );
  });

  it("returns null for an invalid URL (plain string)", () => {
    expect(extractDomain("not a url")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(extractDomain("")).toBeNull();
  });

  it("returns null for a relative path", () => {
    expect(extractDomain("/relative/path")).toBeNull();
  });

  it("preserves subdomains other than www", () => {
    expect(extractDomain("https://politics.theonion.com/article")).toBe(
      "politics.theonion.com"
    );
  });
});

// ── searchArticles — mocked axios ────────────────────────────────────────────
describe("searchArticles", () => {
  beforeEach(() => {
    axiosMocks.create.mockReturnValue({ get: axiosMocks.get });
    axiosMocks.get.mockReset();
  });

  it("returns articles on a successful response with status ok", async () => {
    const fakeArticles = [
      {
        source: { id: "reuters", name: "Reuters" },
        author: "Jane Reporter",
        title: "Candidate wins primary",
        description: "A local candidate won the primary election.",
        url: "https://reuters.com/article/1",
        publishedAt: "2024-03-01T12:00:00Z",
        content: "Full content here.",
      },
    ];

    axiosMocks.get.mockResolvedValue({
      data: { status: "ok", totalResults: 1, articles: fakeArticles },
    });

    const result = await searchArticles("Jane Doe", "2024-01-01");

    expect(result).toEqual(fakeArticles);
    expect(axiosMocks.get).toHaveBeenCalledWith(
      "/everything",
      expect.objectContaining({
        params: expect.objectContaining({ q: '"Jane Doe"', from: "2024-01-01" }),
      })
    );
  });

  it("returns an empty array when articles list is empty", async () => {
    axiosMocks.get.mockResolvedValue({
      data: { status: "ok", totalResults: 0, articles: [] },
    });

    const result = await searchArticles("Nobody Famous", "2024-01-01");
    expect(result).toEqual([]);
  });

  it("returns an empty array when articles key is missing from response", async () => {
    axiosMocks.get.mockResolvedValue({
      data: { status: "ok", totalResults: 0 },
    });

    const result = await searchArticles("Nobody Famous", "2024-01-01");
    expect(result).toEqual([]);
  });

  it("throws when NewsAPI returns a non-ok status", async () => {
    axiosMocks.get.mockResolvedValue({
      data: { status: "error", code: "apiKeyInvalid", message: "Your API key is invalid." },
    });

    await expect(searchArticles("Jane Doe", "2024-01-01")).rejects.toThrow("NewsAPI error:");
  });

  it("passes pageSize parameter to the API", async () => {
    axiosMocks.get.mockResolvedValue({
      data: { status: "ok", totalResults: 0, articles: [] },
    });

    await searchArticles("Jane Doe", "2024-01-01", 25);

    expect(axiosMocks.get).toHaveBeenCalledWith(
      "/everything",
      expect.objectContaining({
        params: expect.objectContaining({ pageSize: 25 }),
      })
    );
  });

  it("wraps the query in quotes for exact phrase matching", async () => {
    axiosMocks.get.mockResolvedValue({
      data: { status: "ok", totalResults: 0, articles: [] },
    });

    await searchArticles("John Smith", "2024-01-01");

    const callParams = axiosMocks.get.mock.calls[0][1].params;
    expect(callParams.q).toBe('"John Smith"');
  });
});
