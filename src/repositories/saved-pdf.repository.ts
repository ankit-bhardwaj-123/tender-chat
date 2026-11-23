import type { SavedPdfSnapshot } from "@/types";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db as defaultDb, type Executor } from "@/server/adapters/postgres";
import { savedPdf, savedPdfFile } from "@/server/schema";

export type SavedPdfRow = typeof savedPdf.$inferSelect;
export type SavedPdfFileRow = typeof savedPdfFile.$inferSelect;
export type SavedPdfFileKind = SavedPdfFileRow["kind"];

export interface NewSavedPdf {
  tenderId: string;
  name: string;
  companyName: string;
  templateName: string;
  storageKey: string;
  sizeBytes: number;
  snapshot: SavedPdfSnapshot | null;
}

export interface NewSavedPdfFile {
  kind: SavedPdfFileKind;
  imageId: string | null;
  storageKey: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export interface SavedPdfReplacement {
  name: string;
  companyName: string;
  templateName: string;
  storageKey: string;
  sizeBytes: number;
  snapshot: SavedPdfSnapshot;
}

export async function insertSavedPdf(
  values: NewSavedPdf,
  db: Executor = defaultDb,
): Promise<SavedPdfRow> {
  const [row] = await db.insert(savedPdf).values(values).returning();
  if (!row) {
    throw new Error("Insert returned no row");
  }
  return row;
}

export async function insertSavedPdfFiles(
  savedPdfId: string,
  files: NewSavedPdfFile[],
  db: Executor = defaultDb,
): Promise<void> {
  if (files.length === 0) return;
  await db.insert(savedPdfFile).values(files.map((file) => ({ savedPdfId, ...file })));
}

export async function findSavedPdfsOfTender(
  tenderId: string,
  db: Executor = defaultDb,
): Promise<SavedPdfRow[]> {
  return db
    .select()
    .from(savedPdf)
    .where(eq(savedPdf.tenderId, tenderId))
    .orderBy(desc(savedPdf.createdAt), desc(savedPdf.id));
}

export async function findSavedPdf(
  tenderId: string,
  pdfId: string,
  db: Executor = defaultDb,
): Promise<SavedPdfRow | null> {
  const [row] = await db
    .select()
    .from(savedPdf)
    .where(and(eq(savedPdf.tenderId, tenderId), eq(savedPdf.id, pdfId)));
  return row ?? null;
}

export async function findSavedPdfNames(
  tenderId: string,
  db: Executor = defaultDb,
): Promise<string[]> {
  const rows = await db
    .select({ name: savedPdf.name })
    .from(savedPdf)
    .where(eq(savedPdf.tenderId, tenderId));
  return rows.map((row) => row.name);
}

export async function findSavedPdfFiles(
  pdfIds: string[],
  db: Executor = defaultDb,
): Promise<SavedPdfFileRow[]> {
  if (pdfIds.length === 0) return [];
  return db.select().from(savedPdfFile).where(inArray(savedPdfFile.savedPdfId, pdfIds));
}

export async function replaceSavedPdf(
  pdfId: string,
  replacement: SavedPdfReplacement,
  files: NewSavedPdfFile[],
  db: Executor = defaultDb,
): Promise<{ row: SavedPdfRow; oldKeys: string[] } | null> {
  const [old] = await db
    .select({ storageKey: savedPdf.storageKey })
    .from(savedPdf)
    .where(eq(savedPdf.id, pdfId))
    .for("update");
  if (!old) return null;
  const oldFiles = await db
    .delete(savedPdfFile)
    .where(eq(savedPdfFile.savedPdfId, pdfId))
    .returning({ storageKey: savedPdfFile.storageKey });
  const [row] = await db
    .update(savedPdf)
    .set({ ...replacement, editedAt: sql`now()` })
    .where(eq(savedPdf.id, pdfId))
    .returning();
  if (!row) return null;
  await insertSavedPdfFiles(pdfId, files, db);
  return { row, oldKeys: [old.storageKey, ...oldFiles.map((file) => file.storageKey)] };
}

export async function findSavedPdfKeysOfTenders(
  tenderIds: string[],
  db: Executor = defaultDb,
): Promise<string[]> {
  if (tenderIds.length === 0) return [];
  const pdfs = await db
    .select({ id: savedPdf.id, storageKey: savedPdf.storageKey })
    .from(savedPdf)
    .where(inArray(savedPdf.tenderId, tenderIds));
  const files = await findSavedPdfFiles(
    pdfs.map((pdf) => pdf.id),
    db,
  );
  return [...pdfs.map((pdf) => pdf.storageKey), ...files.map((file) => file.storageKey)];
}
