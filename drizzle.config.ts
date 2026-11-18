import { defineConfig } from "drizzle-kit";

// drizzle-kit runs outside Next.js, so it loads .env.local itself.
process.loadEnvFile(".env.local");

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
