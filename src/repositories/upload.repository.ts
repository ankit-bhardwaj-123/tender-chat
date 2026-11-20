import { eq } from "drizzle-orm";
import { db as defaultDb, type Executor } from "@/server/adapters/postgres";
import { companyFile, template, tenderImage } from "@/server/schema";

export async function isStorageKeyUsed(key: string, db: Executor = defaultDb): Promise<boolean> {
  const companyRows = await db
    .select({ id: companyFile.companyId })
    .from(companyFile)
    .where(eq(companyFile.storageKey, key))
    .limit(1);
  if (companyRows.length > 0) return true;
  const templateRows = await db
    .select({ id: template.id })
    .from(template)
    .where(eq(template.storageKey, key))
    .limit(1);
  if (templateRows.length > 0) return true;
  const imageRows = await db
    .select({ id: tenderImage.id })
    .from(tenderImage)
    .where(eq(tenderImage.storageKey, key))
    .limit(1);
  return imageRows.length > 0;
}
