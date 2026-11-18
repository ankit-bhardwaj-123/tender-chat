import { describe, expect, it } from "vitest";
import { parseEnv } from "@/server/env";

const VALID = {
  DATABASE_URL: "postgres://u:p@localhost:5432/x",
  BETTER_AUTH_SECRET: "0123456789abcdef0123456789abcdef",
  BETTER_AUTH_URL: "http://localhost:3000",
  GOOGLE_CLIENT_ID: "id",
  GOOGLE_CLIENT_SECRET: "google-secret-value",
};

describe("parseEnv", () => {
  it("accepts the five required keys", () => {
    expect(parseEnv(VALID)).toMatchObject(VALID);
  });

  it("rejects when a Google key is missing or empty", () => {
    expect(() => parseEnv({ ...VALID, GOOGLE_CLIENT_ID: undefined })).toThrow(/GOOGLE_CLIENT_ID/);
    expect(() => parseEnv({ ...VALID, GOOGLE_CLIENT_SECRET: "" })).toThrow(/GOOGLE_CLIENT_SECRET/);
  });

  it("rejects when the auth secret is shorter than 32 characters", () => {
    expect(() => parseEnv({ ...VALID, BETTER_AUTH_SECRET: "short" })).toThrow(/BETTER_AUTH_SECRET/);
  });

  it("rejects when the database url isn't postgres", () => {
    expect(() => parseEnv({ ...VALID, DATABASE_URL: "mysql://u:p@h/x" })).toThrow(/DATABASE_URL/);
  });

  it("doesn't print secret values when it rejects", () => {
    let message = "";
    try {
      parseEnv({ ...VALID, BETTER_AUTH_URL: "not a url" });
    } catch (error) {
      message = String(error);
    }
    expect(message).toMatch(/BETTER_AUTH_URL/);
    expect(message).not.toContain(VALID.GOOGLE_CLIENT_SECRET);
    expect(message).not.toContain(VALID.BETTER_AUTH_SECRET);
  });
});
