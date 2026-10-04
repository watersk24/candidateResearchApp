/**
 * Rate limiter tests (ADR-006)
 *
 * Covers:
 *  - Requests up to the bucket limit pass; the next one gets 429 + Retry-After
 *  - The window resets after a minute
 *  - Clients (IPs) and buckets are counted separately
 *  - Only the last X-Forwarded-For entry is trusted (earlier ones are spoofable)
 *  - IPv6 clients are keyed by /64 so rotating addresses doesn't bypass the limit
 *  - Memory stays bounded when many distinct clients arrive in one window
 *  - Routes return 429 before doing any work
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  clientIp,
  rateLimit,
  RATE_LIMITS,
  resetRateLimits,
  trackedClientCount,
} from "@/lib/rateLimit";

const mockDb = vi.hoisted(() => ({
  election: { findMany: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db: mockDb }));

import { GET as getRaces } from "@/app/api/races/route";
import { GET as getGeocode } from "@/app/api/geocode/route";

function makeRequest(forwardedFor?: string, path = "/api/geocode?zip=27858"): NextRequest {
  const headers = forwardedFor ? { "x-forwarded-for": forwardedFor } : undefined;
  return new NextRequest(`http://localhost:3000${path}`, { headers });
}

const NOW = 1_800_000_000_000;

describe("rateLimit", () => {
  beforeEach(() => {
    resetRateLimits();
    vi.clearAllMocks();
  });

  it("allows requests up to the limit, then returns 429 with Retry-After", async () => {
    for (let i = 0; i < RATE_LIMITS.lookup; i++) {
      expect(rateLimit(makeRequest("203.0.113.5"), "lookup", NOW)).toBeNull();
    }

    const res = rateLimit(makeRequest("203.0.113.5"), "lookup", NOW + 15_000);
    expect(res?.status).toBe(429);
    expect(res?.headers.get("Retry-After")).toBe("45");
    expect(await res?.json()).toEqual({
      error: "Too many requests. Please wait a minute and try again.",
    });
  });

  it("resets the count when the window expires", () => {
    for (let i = 0; i <= RATE_LIMITS.lookup; i++) {
      rateLimit(makeRequest("203.0.113.5"), "lookup", NOW);
    }
    expect(rateLimit(makeRequest("203.0.113.5"), "lookup", NOW)).not.toBeNull();

    expect(rateLimit(makeRequest("203.0.113.5"), "lookup", NOW + 60_000)).toBeNull();
  });

  it("counts each client separately", () => {
    for (let i = 0; i < RATE_LIMITS.lookup; i++) {
      rateLimit(makeRequest("203.0.113.5"), "lookup", NOW);
    }

    expect(rateLimit(makeRequest("203.0.113.5"), "lookup", NOW)).not.toBeNull();
    expect(rateLimit(makeRequest("198.51.100.7"), "lookup", NOW)).toBeNull();
  });

  it("counts each bucket separately", () => {
    for (let i = 0; i < RATE_LIMITS.lookup; i++) {
      rateLimit(makeRequest("203.0.113.5"), "lookup", NOW);
    }

    expect(rateLimit(makeRequest("203.0.113.5"), "lookup", NOW)).not.toBeNull();
    expect(rateLimit(makeRequest("203.0.113.5"), "data", NOW)).toBeNull();
  });

  it("allows a higher limit for data routes than lookup routes", () => {
    for (let i = 0; i < RATE_LIMITS.data; i++) {
      expect(rateLimit(makeRequest("203.0.113.5"), "data", NOW)).toBeNull();
    }
    expect(rateLimit(makeRequest("203.0.113.5"), "data", NOW)).not.toBeNull();
    expect(RATE_LIMITS.data).toBeGreaterThan(RATE_LIMITS.lookup);
  });

  it("cannot be bypassed by sending a different spoofed X-Forwarded-For prefix", () => {
    for (let i = 0; i < RATE_LIMITS.lookup; i++) {
      rateLimit(makeRequest(`10.0.0.${i}, 203.0.113.5`), "lookup", NOW);
    }

    expect(rateLimit(makeRequest("10.9.9.9, 203.0.113.5"), "lookup", NOW)).not.toBeNull();
  });

  it("cannot be bypassed by rotating IPv6 addresses within one /64", () => {
    for (let i = 0; i < RATE_LIMITS.lookup; i++) {
      rateLimit(makeRequest(`2001:db8:1:2::${(i + 1).toString(16)}`), "lookup", NOW);
    }

    expect(rateLimit(makeRequest("2001:db8:1:2:ffff:ffff:ffff:ffff"), "lookup", NOW)).not.toBeNull();
    expect(rateLimit(makeRequest("2001:db8:1:3::1"), "lookup", NOW)).toBeNull();
  });

  it("stays within its memory bound when many distinct clients arrive at once", () => {
    for (let i = 0; i < 12_000; i++) {
      rateLimit(makeRequest(`198.51.${Math.floor(i / 256)}.${i % 256}`), "lookup", NOW);
    }

    expect(trackedClientCount()).toBeLessThanOrEqual(10_000);
  });

  it("evicts expired windows before active ones", () => {
    for (let i = 0; i < 10_000; i++) {
      rateLimit(makeRequest(`198.51.${Math.floor(i / 256)}.${i % 256}`), "data", NOW);
    }
    // Over the lookup limit, started after the data windows
    for (let i = 0; i <= RATE_LIMITS.lookup; i++) {
      rateLimit(makeRequest("203.0.113.5"), "lookup", NOW + 30_000);
    }

    // The data windows have expired; a new client triggers eviction of those,
    // and the active over-limit client keeps its count
    rateLimit(makeRequest("192.0.2.1"), "lookup", NOW + 61_000);
    expect(rateLimit(makeRequest("203.0.113.5"), "lookup", NOW + 61_000)).not.toBeNull();
  });
});

describe("clientIp", () => {
  it("uses the last X-Forwarded-For entry, which Cloud Run appends", () => {
    expect(clientIp(makeRequest("1.2.3.4, 203.0.113.5"))).toBe("203.0.113.5");
    expect(clientIp(makeRequest("203.0.113.5"))).toBe("203.0.113.5");
  });

  it("keys IPv6 clients by their /64 prefix", () => {
    expect(clientIp(makeRequest("2001:0db8:0001:0002:aaaa:bbbb:cccc:dddd"))).toBe("2001:db8:1:2::/64");
    expect(clientIp(makeRequest("2001:db8:1:2::5"))).toBe("2001:db8:1:2::/64");
    expect(clientIp(makeRequest("2001:db8::1"))).toBe("2001:db8:0:0::/64");
    expect(clientIp(makeRequest("::1"))).toBe("0:0:0:0::/64");
  });

  it("keys IPv4-mapped IPv6 addresses as IPv4", () => {
    expect(clientIp(makeRequest("::ffff:203.0.113.5"))).toBe("203.0.113.5");
  });

  it("falls back to a shared key when the header is missing", () => {
    expect(clientIp(makeRequest())).toBe("unknown");
  });
});

describe("route integration", () => {
  beforeEach(() => {
    resetRateLimits();
    vi.clearAllMocks();
    mockDb.election.findMany.mockResolvedValue([]);
  });

  it("GET /api/races returns 429 over the limit without querying the database", async () => {
    const path = "/api/races?districtIds=ocd-division/country:us/state:nc/cd:1";
    for (let i = 0; i < RATE_LIMITS.data; i++) {
      expect((await getRaces(makeRequest("203.0.113.5", path))).status).toBe(200);
    }
    mockDb.election.findMany.mockClear();

    const res = await getRaces(makeRequest("203.0.113.5", path));

    expect(res.status).toBe(429);
    expect(mockDb.election.findMany).not.toHaveBeenCalled();
  });

  it("GET /api/geocode returns 429 over the limit without calling the upstream service", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    for (let i = 0; i < RATE_LIMITS.lookup; i++) {
      rateLimit(makeRequest("203.0.113.5"), "lookup");
    }

    const res = await getGeocode(makeRequest("203.0.113.5"));

    expect(res.status).toBe(429);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
