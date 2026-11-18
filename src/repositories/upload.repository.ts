import { eq } from "drizzle-orm";
import { db as defaultDb, type Executor } from "@/server/adapters/postgres";
import { companyFile } from "@/server/schema";

export async function isStorageKeyUsed(key: string, db: Executor = defaultDb): Promise<boolean> {
  const rows = await db
    .select({ id: companyFile.companyId })
    .from(companyFile)
    .where(eq(companyFile.storageKey, key))
    .limit(1);
  return rows.length > 0;
}
