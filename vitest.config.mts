import path from "node:path"

import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname) },
  },
  test: {
    environment: "jsdom",
    include: ["components/**/*.test.tsx", "lib/**/*.test.ts", "lib/**/*.test.tsx"],
    setupFiles: ["./vitest.setup.ts"],
  },
})
