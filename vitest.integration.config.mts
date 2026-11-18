import path from "node:path";
import { defineConfig } from "vitest/config";

process.loadEnvFile(".env.local");

const testDatabaseUrl = new URL(process.env.DATABASE_URL ?? "");
testDatabaseUrl.pathname = "/tender_chat_test";

process.env.DATABASE_URL = testDatabaseUrl.toString();
process.env.NEXT_PUBLIC_FILE_STORE = "local";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    globalSetup: ["tests/integration/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 20_000,
    passWithNoTests: true,
  },
});
