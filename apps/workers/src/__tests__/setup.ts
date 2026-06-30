// Global test setup for apps/workers
// Sets dummy environment variables so modules that check them at load time don't throw.
// Tests that need specific values override them with vi.stubEnv() in beforeEach.

process.env.CONGRESS_API_KEY = "test-congress-key";
process.env.FEC_API_KEY = "test-fec-key";
process.env.NEWS_API_KEY = "test-news-key";
process.env.REDIS_URL = "redis://localhost:6379/0";
process.env.SENTIMENT_API_URL = "http://localhost:8080";
process.env.NODE_ENV = "test";
