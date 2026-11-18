import { and, desc, eq, ilike } from "drizzle-orm";
import { db as defaultDb, type Executor } from "@/server/adapters/postgres";
import { ownedBy } from "@/server/ownership";
import { tender } from "@/server/schema";

export type TenderRow = typeof tender.$inferSelect;

export async function findAllTendersByUser(
  userId: string,
  search = "",
  db: Executor = defaultDb,
): Promise<TenderRow[]> {
  const term = search.trim();
  const pattern = term ? `%${term.replace(/[\%_]/g, "\$&")}%` : null;
  return db
    .select()
    .from(tender)
    .where(pattern ? and(ownedBy(userId), ilike(tender.name, pattern)) : ownedBy(userId))
    .orderBy(desc(tender.updatedAt));
}

export async function findTenderById(
  userId: string,
  tenderId: string,
  db: Executor = defaultDb,
): Promise<TenderRow | null> {
  const [row] = await db
    .select()
    .from(tender)
    .where(and(eq(tender.id, tenderId), ownedBy(userId)));
  return row ?? null;
}

export async function createTender(
  userId: string,
  name: string,
  db: Executor = defaultDb,
): Promise<TenderRow> {
  const [row] = await db.insert(tender).values({ userId, name }).returning();
  if (!row) {
    throw new Error("Insert returned no row");
  }
  return row;
}

export async function updateTenderName(
  userId: string,
  tenderId: string,
  name: string,
  db: Executor = defaultDb,
): Promise<TenderRow | null> {
  const [row] = await db
    .update(tender)
    .set({ name, updatedAt: new Date() })
    .where(and(eq(tender.id, tenderId), ownedBy(userId)))
    .returning();
  return row ?? null;
}

export async function removeTender(
  userId: string,
  tenderId: string,
  db: Executor = defaultDb,
): Promise<boolean> {
  const removed = await db
    .delete(tender)
    .where(and(eq(tender.id, tenderId), ownedBy(userId)))
    .returning({ id: tender.id });
  return removed.length > 0;
}
