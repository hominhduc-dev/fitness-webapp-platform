import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    /**
     * Tests are colocated with the code they cover (`src/**\/*.test.ts`) so a module
     * and its contract stay visible together. They are excluded from the production
     * build via tsconfig.build.json.
     */
    coverage: {
      exclude: ["src/scripts/**", "src/**/*.test.ts", "src/index.ts"],
      include: ["src/**/*.ts"],
      provider: "v8",
      reporter: ["text-summary", "lcov"],
    },
    environment: "node",
    include: ["src/**/*.test.ts"],
    // The env module reads process.env at import time; keep runs deterministic and
    // never let a developer's local .env (or its credentials) reach a test.
    env: {
      ENV_SKIP_DOTENV: "1",
      LOG_LEVEL: "error",
      NODE_ENV: "test",
    },
    restoreMocks: true,
  },
})
