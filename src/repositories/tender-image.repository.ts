import { and, eq } from "drizzle-orm";
import { db as defaultDb, type Executor } from "@/server/adapters/postgres";
import { tenderImage } from "@/server/schema";

export type TenderImageRow = typeof tenderImage.$inferSelect;

export interface NewTenderImage {
  tenderId: string;
  storageKey: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export async function insertTenderImage(
  values: NewTenderImage,
  db: Executor = defaultDb,
): Promise<TenderImageRow> {
  const [row] = await db.insert(tenderImage).values(values).returning();
  if (!row) {
    throw new Error("Insert returned no row");
  }
  return row;
}

export async function findTenderImage(
  tenderId: string,
  imageId: string,
  db: Executor = defaultDb,
): Promise<TenderImageRow | null> {
  const [row] = await db
    .select()
    .from(tenderImage)
    .where(and(eq(tenderImage.tenderId, tenderId), eq(tenderImage.id, imageId)));
  return row ?? null;
}

export async function findImageKeysOfTender(
  tenderId: string,
  db: Executor = defaultDb,
): Promise<string[]> {
  const rows = await db
    .select({ storageKey: tenderImage.storageKey })
    .from(tenderImage)
    .where(eq(tenderImage.tenderId, tenderId));
  return rows.map((row) => row.storageKey);
}

export async function deleteTenderImage(
  tenderId: string,
  imageId: string,
  db: Executor = defaultDb,
): Promise<string | null> {
  const [row] = await db
    .delete(tenderImage)
    .where(and(eq(tenderImage.tenderId, tenderId), eq(tenderImage.id, imageId)))
    .returning({ storageKey: tenderImage.storageKey });
  return row?.storageKey ?? null;
}
