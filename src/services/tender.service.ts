import { findCompaniesByUser, findCompanyById } from "@/repositories/company.repository";
import { findTemplateById, findTemplatesByUser } from "@/repositories/template.repository";
import {
  createTender,
  findAllTendersByUser,
  findTenderById,
  removeTender,
  type TenderChanges,
  updateTender as updateTenderRow,
} from "@/repositories/tender.repository";
import { invalid, notFound } from "@/server/errors";
import { toTender } from "@/shared/dto";
import type { Tender } from "@/types";

export interface TenderUpdate {
  name?: string;
  companyId?: string | null;
  templateId?: string | null;
  values?: Record<string, string>;
}

const NAME_MAX_LENGTH = 200;
const DEFAULT_NAME = "Untitled tender";
const NOT_FOUND = "Tender not found.";

function cleanName(raw: string): string | null {
  const name = raw.normalize("NFC").replace(/\s+/g, " ").trim();
  return name.length === 0 || name.length > NAME_MAX_LENGTH ? null : name;
}

export async function listTenders(userId: string, search = ""): Promise<Tender[]> {
  const rows = await findAllTendersByUser(userId, search);
  return rows.map((row) => toTender(row));
}

export async function getTender(userId: string, tenderId: string): Promise<Tender> {
  const row = await findTenderById(userId, tenderId);
  if (!row) {
    throw notFound(NOT_FOUND);
  }
  return toTender(row);
}

export async function createTenderItem(userId: string, rawName?: string): Promise<Tender> {
  const name = (rawName && cleanName(rawName)) || DEFAULT_NAME;
  const [companies, templates] = await Promise.all([
    findCompaniesByUser(userId),
    findTemplatesByUser(userId),
  ]);
  const row = await createTender(userId, {
    name,
    companyId: companies[0]?.id ?? null,
    templateId: templates[0]?.id ?? null,
  });
  return toTender(row);
}

function cleanValues(values: Record<string, string>): Record<string, string> {
  const clean: Record<string, string> = {};
  for (const [rawKey, value] of Object.entries(values)) {
    const key = rawKey.normalize("NFC").replace(/\s+/g, " ").trim();
    if (key !== "") clean[key] = value.normalize("NFC");
  }
  return clean;
}

async function checkedChanges(userId: string, update: TenderUpdate): Promise<TenderChanges> {
  const changes: TenderChanges = {};
  if (update.name !== undefined) {
    const name = cleanName(update.name);
    if (!name) {
      throw invalid(`A name must be 1–${NAME_MAX_LENGTH} characters.`);
    }
    changes.name = name;
  }
  if (update.companyId !== undefined) {
    if (update.companyId !== null && !(await findCompanyById(userId, update.companyId))) {
      throw notFound("Company not found.");
    }
    changes.companyId = update.companyId;
  }
  if (update.templateId !== undefined) {
    if (update.templateId !== null && !(await findTemplateById(userId, update.templateId))) {
      throw notFound("Template not found.");
    }
    changes.templateId = update.templateId;
  }
  if (update.values !== undefined) changes.values = cleanValues(update.values);
  return changes;
}

export async function updateTender(
  userId: string,
  tenderId: string,
  update: TenderUpdate,
): Promise<Tender> {
  if (!(await findTenderById(userId, tenderId))) {
    throw notFound(NOT_FOUND);
  }
  const row = await updateTenderRow(userId, tenderId, await checkedChanges(userId, update));
  if (!row) {
    throw notFound(NOT_FOUND);
  }
  return toTender(row);
}

export async function deleteTender(userId: string, tenderId: string): Promise<void> {
  const removed = await removeTender(userId, tenderId);
  if (!removed) {
    throw notFound(NOT_FOUND);
  }
}
