import type { TenderCanvas } from "@/types";
import { and, desc, eq, sql } from "drizzle-orm";
import { db as defaultDb, type Executor } from "@/server/adapters/postgres";
import { ownedBy } from "@/server/ownership";
import { tender } from "@/server/schema";

export type TenderRow = typeof tender.$inferSelect;

export interface NewTender {
  parentId: string | null;
  name: string;
  companyId: string | null;
  templateId: string | null;
}

export interface TenderChanges {
  parentId?: string | null;
  editingPdfId?: string | null;
  name?: string;
  companyId?: string | null;
  templateId?: string | null;
  values?: Record<string, string>;
  customHtml?: string | null;
  canvas?: TenderCanvas;
}

export async function findAllTendersByUser(
  userId: string,
  db: Executor = defaultDb,
): Promise<TenderRow[]> {
  return db.select().from(tender).where(ownedBy(userId)).orderBy(desc(tender.updatedAt));
}

export async function lockFoldersOfUser(userId: string, db: Executor = defaultDb): Promise<void> {
  await db.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);
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
  values: NewTender,
  db: Executor = defaultDb,
): Promise<TenderRow> {
  const [row] = await db
    .insert(tender)
    .values({ userId, ...values })
    .returning();
  if (!row) {
    throw new Error("Insert returned no row");
  }
  return row;
}

export async function updateTender(
  userId: string,
  tenderId: string,
  changes: TenderChanges,
  db: Executor = defaultDb,
): Promise<TenderRow | null> {
  const set: TenderChanges = {};
  if (changes.parentId !== undefined) set.parentId = changes.parentId;
  if (changes.editingPdfId !== undefined) set.editingPdfId = changes.editingPdfId;
  if (changes.name !== undefined) set.name = changes.name;
  if (changes.companyId !== undefined) set.companyId = changes.companyId;
  if (changes.templateId !== undefined) set.templateId = changes.templateId;
  if (changes.values !== undefined) set.values = changes.values;
  if (changes.customHtml !== undefined) set.customHtml = changes.customHtml;
  if (changes.canvas !== undefined) set.canvas = changes.canvas;
  const [row] = await db
    .update(tender)
    .set({ ...set, updatedAt: sql`now()` })
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

export async function lockTender(
  userId: string,
  tenderId: string,
  db: Executor = defaultDb,
): Promise<TenderRow | null> {
  const [row] = await db
    .select()
    .from(tender)
    .where(and(eq(tender.id, tenderId), ownedBy(userId)))
    .for("update");
  return row ?? null;
}
