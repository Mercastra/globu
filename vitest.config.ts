import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts", "tests/**/*.test.ts"],
    setupFiles: ["vitest.setup.ts"],
    coverage: {
      provider: "v8",
      include: ["packages/**/*.ts"],
      exclude: [
        "packages/**/*.test.ts",
        "packages/testing/**",
        "packages/*/src/bin/**",
        "packages/cli-common/src/process-io.ts"
      ],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100
      }
    }
  }
});
