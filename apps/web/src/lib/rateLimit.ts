import { NextRequest, NextResponse } from "next/server";

/**
 * Per-IP fixed-window rate limiting for the public API (ADR-006).
 *
 * Counts live in this server instance's memory, so the effective limit is
 * roughly `limit × instance count` and resets on cold start. Cloud Run's
 * max-instances cap bounds the total. This protects the free upstream APIs
 * (Census Geocoder, Zippopotam.us) and the database from a single abusive
 * client; it is not a substitute for edge protection such as Cloud Armor.
 */

const WINDOW_MS = 60_000;
const MAX_TRACKED_CLIENTS = 10_000;
// When full, evict down to this size so a burst of new clients doesn't trigger
// a full scan on every request
const EVICT_TO = Math.floor(MAX_TRACKED_CLIENTS * 0.9);

export const RATE_LIMITS = {
  // Routes that call third-party lookup services
  lookup: 30,
  // Routes that only read the database
  data: 120,
} as const;

export type RateLimitBucket = keyof typeof RATE_LIMITS;

type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();
let warnedMissingIp = false;

/**
 * Client IP as seen by Cloud Run. Google's front end appends the connecting
 * address to X-Forwarded-For, so only the last entry is trustworthy; earlier
 * entries are client-supplied and can be spoofed. Behind a load balancer the
 * last entry would be the balancer, and this must change.
 */
export function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const last = forwarded?.split(",").at(-1)?.trim();
  if (last) return clientKey(last);

  if (!warnedMissingIp && process.env.NODE_ENV === "production") {
    warnedMissingIp = true;
    console.warn("rateLimit: X-Forwarded-For missing; all such clients share one rate limit");
  }
  return "unknown";
}

/**
 * One IPv6 host usually controls a whole /64, so IPv6 clients are keyed by
 * their /64 prefix; otherwise a single client could rotate addresses to
 * bypass the limit. IPv4 (including IPv4-mapped IPv6) is keyed by address.
 */
function clientKey(ip: string): string {
  if (!ip.includes(":")) return ip;
  if (ip.includes(".")) return ip.slice(ip.lastIndexOf(":") + 1); // ::ffff:1.2.3.4

  const address = ip.split("%")[0].toLowerCase(); // drop zone ID
  const [head, tail] = address.split("::");
  const headParts = head ? head.split(":") : [];
  const tailParts = tail ? tail.split(":") : [];
  const groups =
    tail === undefined
      ? headParts
      : [...headParts, ...Array(8 - headParts.length - tailParts.length).fill("0"), ...tailParts];
  return `${groups
    .slice(0, 4)
    .map((g) => g.replace(/^0+(?=.)/, ""))
    .join(":")}::/64`;
}

function evict(now: number) {
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
  // Still full (many distinct clients in one window): drop the least recently
  // started windows (Map iteration follows insertion order)
  for (const key of windows.keys()) {
    if (windows.size <= EVICT_TO) break;
    windows.delete(key);
  }
}

/**
 * Records a request and returns a 429 response if the client is over the
 * bucket's limit, or null if the request may proceed.
 */
export function rateLimit(
  request: NextRequest,
  bucket: RateLimitBucket,
  now: number = Date.now()
): NextResponse | null {
  const key = `${bucket}:${clientIp(request)}`;
  let window = windows.get(key);

  if (!window || window.resetAt <= now) {
    // Re-insert so the Map's order tracks when each window started
    windows.delete(key);
    if (windows.size >= MAX_TRACKED_CLIENTS) evict(now);
    window = { count: 0, resetAt: now + WINDOW_MS };
    windows.set(key, window);
  }

  window.count += 1;
  if (window.count <= RATE_LIMITS[bucket]) return null;

  const retryAfterSeconds = Math.ceil((window.resetAt - now) / 1000);
  return NextResponse.json(
    { error: "Too many requests. Please wait a minute and try again." },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
  );
}

/** Test helper: clears all recorded windows. */
export function resetRateLimits() {
  windows.clear();
}

/** Test helper: number of client windows held in memory. */
export function trackedClientCount() {
  return windows.size;
}
