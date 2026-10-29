import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// Unit tests for pure logic only. Pages are covered by Playwright in e2e/.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
