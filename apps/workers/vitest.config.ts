import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Allow TypeScript files to be imported with .js extensions (ESM style)
    extensionAlias: {
      ".js": [".ts", ".js"],
    },
  },
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./src/__tests__/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/__tests__/**", "src/scripts/**", "src/index.ts"],
    },
  },
});
