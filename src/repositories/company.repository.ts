import { and, asc, eq, inArray } from "drizzle-orm";
import { db as defaultDb, type Executor } from "@/server/adapters/postgres";
import { company, companyFile } from "@/server/schema";
import type { CompanyFileKind } from "@/types";

export type CompanyRow = typeof company.$inferSelect;
export type CompanyFileRow = typeof companyFile.$inferSelect;

export interface NewCompanyFile {
  kind: CompanyFileKind;
  storageKey: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

function activeCompanyOf(userId: string) {
  return and(eq(company.userId, userId), eq(company.status, "active"));
}

export async function findCompaniesByUser(
  userId: string,
  db: Executor = defaultDb,
): Promise<CompanyRow[]> {
  return db
    .select()
    .from(company)
    .where(activeCompanyOf(userId))
    .orderBy(asc(company.createdAt), asc(company.id));
}

export async function findCompanyById(
  userId: string,
  companyId: string,
  db: Executor = defaultDb,
): Promise<CompanyRow | null> {
  const [row] = await db
    .select()
    .from(company)
    .where(and(eq(company.id, companyId), activeCompanyOf(userId)));
  return row ?? null;
}

export async function findFilesOfCompanies(
  companyIds: readonly string[],
  db: Executor = defaultDb,
): Promise<CompanyFileRow[]> {
  if (companyIds.length === 0) return [];
  return db
    .select()
    .from(companyFile)
    .where(inArray(companyFile.companyId, [...companyIds]));
}

export async function findCompanyFile(
  companyId: string,
  kind: CompanyFileKind,
  db: Executor = defaultDb,
): Promise<CompanyFileRow | null> {
  const [row] = await db
    .select()
    .from(companyFile)
    .where(and(eq(companyFile.companyId, companyId), eq(companyFile.kind, kind)));
  return row ?? null;
}

export async function insertCompany(
  userId: string,
  name: string,
  db: Executor = defaultDb,
): Promise<CompanyRow> {
  const [row] = await db.insert(company).values({ userId, name }).returning();
  if (!row) {
    throw new Error("Insert returned no row");
  }
  return row;
}

export async function updateCompanyName(
  userId: string,
  companyId: string,
  name: string,
  db: Executor = defaultDb,
): Promise<CompanyRow | null> {
  const [row] = await db
    .update(company)
    .set({ name, updatedAt: new Date() })
    .where(and(eq(company.id, companyId), activeCompanyOf(userId)))
    .returning();
  return row ?? null;
}

export async function voidCompany(
  userId: string,
  companyId: string,
  db: Executor = defaultDb,
): Promise<boolean> {
  const [row] = await db
    .update(company)
    .set({ status: "void", updatedAt: new Date() })
    .where(and(eq(company.id, companyId), activeCompanyOf(userId)))
    .returning({ id: company.id });
  return row !== undefined;
}

export async function lockCompanyFile(
  companyId: string,
  kind: CompanyFileKind,
  tx: Executor,
): Promise<CompanyFileRow | null> {
  const [row] = await tx
    .select()
    .from(companyFile)
    .where(and(eq(companyFile.companyId, companyId), eq(companyFile.kind, kind)))
    .for("update");
  return row ?? null;
}

export async function upsertCompanyFile(
  companyId: string,
  values: NewCompanyFile,
  db: Executor = defaultDb,
): Promise<CompanyFileRow> {
  const [row] = await db
    .insert(companyFile)
    .values({ ...values, companyId })
    .onConflictDoUpdate({
      target: [companyFile.companyId, companyFile.kind],
      set: {
        storageKey: values.storageKey,
        fileName: values.fileName,
        contentType: values.contentType,
        sizeBytes: values.sizeBytes,
        createdAt: new Date(),
      },
    })
    .returning();
  if (!row) {
    throw new Error("Upsert returned no row");
  }
  return row;
}

export async function deleteCompanyFile(
  companyId: string,
  kind: CompanyFileKind,
  db: Executor = defaultDb,
): Promise<string | null> {
  const [row] = await db
    .delete(companyFile)
    .where(and(eq(companyFile.companyId, companyId), eq(companyFile.kind, kind)))
    .returning({ storageKey: companyFile.storageKey });
  return row?.storageKey ?? null;
}
