import { and, asc, eq } from "drizzle-orm";
import { db as defaultDb, type Executor } from "@/server/adapters/postgres";
import { template } from "@/server/schema";
import type { TemplateLanguage } from "@/types";

export type TemplateRow = typeof template.$inferSelect;

export interface NewTemplate {
  name: string;
  language: TemplateLanguage;
  storageKey: string;
  fileName: string;
  sizeBytes: number;
  placeholders: string[];
}

export interface TemplateChanges {
  name?: string;
  language?: TemplateLanguage;
  storageKey?: string;
  fileName?: string;
  sizeBytes?: number;
  placeholders?: string[];
}

function activeTemplateOf(userId: string) {
  return and(eq(template.userId, userId), eq(template.status, "active"));
}

export async function findTemplatesByUser(
  userId: string,
  db: Executor = defaultDb,
): Promise<TemplateRow[]> {
  return db
    .select()
    .from(template)
    .where(activeTemplateOf(userId))
    .orderBy(asc(template.createdAt), asc(template.id));
}

export async function findTemplateById(
  userId: string,
  templateId: string,
  db: Executor = defaultDb,
): Promise<TemplateRow | null> {
  const [row] = await db
    .select()
    .from(template)
    .where(and(eq(template.id, templateId), activeTemplateOf(userId)));
  return row ?? null;
}

export async function insertTemplate(
  userId: string,
  values: NewTemplate,
  db: Executor = defaultDb,
): Promise<TemplateRow> {
  const [row] = await db
    .insert(template)
    .values({ ...values, userId })
    .returning();
  if (!row) {
    throw new Error("Insert returned no row");
  }
  return row;
}

export async function updateTemplate(
  userId: string,
  templateId: string,
  changes: TemplateChanges,
  db: Executor = defaultDb,
): Promise<TemplateRow | null> {
  const [row] = await db
    .update(template)
    .set({ ...changes, updatedAt: new Date() })
    .where(and(eq(template.id, templateId), activeTemplateOf(userId)))
    .returning();
  return row ?? null;
}

export async function lockTemplate(
  userId: string,
  templateId: string,
  tx: Executor,
): Promise<TemplateRow | null> {
  const [row] = await tx
    .select()
    .from(template)
    .where(and(eq(template.id, templateId), activeTemplateOf(userId)))
    .for("update");
  return row ?? null;
}

export async function voidTemplate(
  userId: string,
  templateId: string,
  db: Executor = defaultDb,
): Promise<boolean> {
  const [row] = await db
    .update(template)
    .set({ status: "void", updatedAt: new Date() })
    .where(and(eq(template.id, templateId), activeTemplateOf(userId)))
    .returning({ id: template.id });
  return row !== undefined;
}
