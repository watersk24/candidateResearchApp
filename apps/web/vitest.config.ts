import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    // Default environment is "node" for the existing API route tests, which
    // exercise Next.js route handlers rather than the DOM. Component tests
    // under src/__tests__/components/** opt into jsdom individually via a
    // `// @vitest-environment jsdom` docblock at the top of each file
    // (Vitest 4 removed the `environmentMatchGlobs` config option that
    // used to scope this by glob).
    environment: "node",
    setupFiles: ["./src/__tests__/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: ["src/__tests__/**"],
    },
  },
});
