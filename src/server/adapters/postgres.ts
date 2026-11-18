import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../env";
import * as schema from "../schema";

export type Database = PostgresJsDatabase<typeof schema>;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type Executor = Database | Transaction;

let cachedDb: Database | null = null;
let cachedSql: postgres.Sql | null = null;

export function createDb(connectionUrl = env.DATABASE_URL): { db: Database; sql: postgres.Sql } {
  const sql = postgres(connectionUrl);
  const db = drizzle(sql, { schema });
  return { db, sql };
}

export function getDb(): Database {
  if (!cachedDb) {
    const client = createDb();
    cachedDb = client.db;
    cachedSql = client.sql;
  }
  return cachedDb;
}

export async function closeDb(): Promise<void> {
  if (cachedSql) {
    await cachedSql.end({ timeout: 5 });
  }
  cachedDb = null;
  cachedSql = null;
}

export const db = new Proxy({} as Database, {
  get(_target, prop) {
    return Reflect.get(getDb(), prop);
  },
});
