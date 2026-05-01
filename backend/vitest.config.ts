import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/__tests__/**/*.test.ts"],
    clearMocks: true,
    restoreMocks: true,
    setupFiles: ["src/__tests__/setup-env.ts"],
  },
});
