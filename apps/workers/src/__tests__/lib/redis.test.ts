/**
 * redis.ts tests
 *
 * Covers:
 *  - bullmqConnection shape: host/port/db/password parsed from REDIS_URL (Priority 1)
 *
 * Strategy: ioredis is mocked to prevent real connections. Each test
 * clears the module cache so a fresh REDIS_URL can be evaluated.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock ioredis so no real connection is attempted.
// vi.mock is hoisted before imports, so this intercepts the module-level
// `new Redis(...)` call inside redis.ts before it runs.
// Arrow functions cannot be used as constructors (new X()), so we use a class.
vi.mock("ioredis", () => ({
  Redis: class MockRedis {
    // Minimal stub — tests only inspect bullmqConnection, not the Redis instance itself
  },
}));

describe("bullmqConnection", () => {
  beforeEach(() => {
    // Clear the module registry before each test so each dynamic import
    // picks up whatever REDIS_URL is currently set.
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("parses host and default port from a standard redis URL", async () => {
    vi.stubEnv("REDIS_URL", "redis://localhost:6379/0");
    const { bullmqConnection } = await import("../../lib/redis.js");
    expect(bullmqConnection.host).toBe("localhost");
    expect(bullmqConnection.port).toBe(6379);
  });

  it("parses db index from the URL pathname", async () => {
    vi.stubEnv("REDIS_URL", "redis://localhost:6379/3");
    const { bullmqConnection } = await import("../../lib/redis.js");
    expect(bullmqConnection.db).toBe(3);
  });

  it("defaults db to 0 when pathname is empty", async () => {
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");
    const { bullmqConnection } = await import("../../lib/redis.js");
    expect(bullmqConnection.db).toBe(0);
  });

  it("parses a non-standard port", async () => {
    vi.stubEnv("REDIS_URL", "redis://localhost:6380/0");
    const { bullmqConnection } = await import("../../lib/redis.js");
    expect(bullmqConnection.port).toBe(6380);
  });

  it("extracts password from URL and omits it when absent", async () => {
    vi.stubEnv("REDIS_URL", "redis://:supersecret@myredishost:6379/0");
    const { bullmqConnection } = await import("../../lib/redis.js");
    expect(bullmqConnection.password).toBe("supersecret");
    expect(bullmqConnection.host).toBe("myredishost");
  });

  it("sets password to undefined when not present in URL", async () => {
    vi.stubEnv("REDIS_URL", "redis://localhost:6379/0");
    const { bullmqConnection } = await import("../../lib/redis.js");
    expect(bullmqConnection.password).toBeUndefined();
  });
});
