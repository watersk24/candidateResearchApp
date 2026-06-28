import { Redis } from "ioredis";

if (!process.env.REDIS_URL) {
  throw new Error("REDIS_URL environment variable is required");
}

// Used for direct ioredis operations (e.g. caching, pub/sub)
export const redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

// BullMQ bundles its own ioredis so it cannot accept a shared Redis instance.
// Pass connection options as a plain object instead.
const url = new URL(process.env.REDIS_URL);
export const bullmqConnection = {
  host: url.hostname,
  port: parseInt(url.port || "6379", 10),
  password: url.password || undefined,
  db: url.pathname ? parseInt(url.pathname.slice(1) || "0", 10) : 0,
};
