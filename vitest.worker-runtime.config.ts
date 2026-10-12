import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [cloudflareTest({ wrangler: { configPath: "./wrangler.jsonc" } })],
  test: {
    include: ["tests/worker/runtime/**/*.test.ts"],
    setupFiles: ["tests/worker/runtime/setup.ts"],
    dangerouslyIgnoreUnhandledErrors: false,
  },
});
