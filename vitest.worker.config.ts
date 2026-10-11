import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    dangerouslyIgnoreUnhandledErrors: false,
    include: ["tests/worker/**/*.test.ts"],
  },
});
