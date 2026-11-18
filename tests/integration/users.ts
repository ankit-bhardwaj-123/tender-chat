import { readdir, rm } from "node:fs/promises";
import path from "node:path";
import { betterAuth } from "better-auth";
import { testUtils } from "better-auth/plugins";
import { inArray } from "drizzle-orm";
import { db } from "@/server/adapters/postgres";
import { authOptions } from "@/server/auth";
import { env } from "@/server/env";
import { user } from "@/server/schema";

export interface TestUser {
  id: string;
  cookie: string;
}

const testAuth = betterAuth({ ...authOptions, plugins: [testUtils()] });

export async function createSignedInUser(): Promise<TestUser> {
  const { test } = await testAuth.$context;
  const saved = await test.saveUser(test.createUser({ name: "Integration test" }));
  const login = await test.login({ userId: saved.id });
  const cookie = login.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  return { id: saved.id, cookie };
}

export async function deleteUsers(users: readonly TestUser[]): Promise<void> {
  if (users.length === 0) return;
  await Promise.all(
    users.map((u) =>
      rm(path.resolve("storage", "uploads", u.id), { recursive: true, force: true }),
    ),
  );
  await db.delete(user).where(
    inArray(
      user.id,
      users.map((u) => u.id),
    ),
  );
}

export function apiRequest(as: TestUser | null, path: string, init: RequestInit = {}): Request {
  const headers = new Headers(init.headers);
  if (as) headers.set("cookie", as.cookie);
  return new Request(new URL(path, env.BETTER_AUTH_URL), { ...init, headers });
}

export function jsonBody(method: string, body: unknown): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

export function idParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

export async function uploadedFiles(userId: string): Promise<string[]> {
  return readdir(path.resolve("storage", "uploads", userId)).catch(() => []);
}

export function fileParams(
  id: string,
  kind: string,
): { params: Promise<{ id: string; kind: string }> } {
  return { params: Promise.resolve({ id, kind }) };
}
