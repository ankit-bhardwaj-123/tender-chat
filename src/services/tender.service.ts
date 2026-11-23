import { findCompaniesByUser, findCompanyById } from "@/repositories/company.repository";
import { findTemplateById, findTemplatesByUser } from "@/repositories/template.repository";
import {
  createTender,
  findAllTendersByUser,
  findTenderById,
  lockFoldersOfUser,
  removeTender,
  type TenderChanges,
  updateTender as updateTenderRow,
} from "@/repositories/tender.repository";
import { findSavedPdfKeysOfTenders } from "@/repositories/saved-pdf.repository";
import { findImageKeysOfTenders } from "@/repositories/tender-image.repository";
import { storage } from "@/server/adapters/file-storage";
import { db } from "@/server/adapters/postgres";
import { invalid, notFound } from "@/server/errors";
import { reportError } from "@/server/report-error";
import { toTender } from "@/shared/dto";
import { descendantIds, withAncestors } from "@/shared/folder-tree";
import type { CreatedTender, Tender, TenderCanvas } from "@/types";

export interface TenderUpdate {
  parentId?: string | null;
  editingPdfId?: null;
  name?: string;
  companyId?: string | null;
  templateId?: string | null;
  values?: Record<string, string>;
  customHtml?: string | null;
  canvas?: TenderCanvas;
}

const NAME_MAX_LENGTH = 200;
const DEFAULT_NAME = "Untitled tender";
const NOT_FOUND = "Tender not found.";
const LOOP = "A folder can't go inside itself or its own subfolder.";

export interface NewTenderInput {
  name?: string;
  parentId?: string;
  subfolderName?: string;
}

function searchKey(text: string): string {
  return text.normalize("NFC").toLocaleLowerCase();
}

function cleanName(raw: string): string | null {
  const name = raw.normalize("NFC").replace(/\s+/g, " ").trim();
  return name.length === 0 || name.length > NAME_MAX_LENGTH ? null : name;
}

export async function listTenders(userId: string, search = ""): Promise<Tender[]> {
  const rows = await findAllTendersByUser(userId);
  const term = searchKey(search.trim());
  if (term === "") {
    return rows.map((row) => toTender(row));
  }
  const matches = new Set(
    rows.filter((row) => searchKey(row.name).includes(term)).map((row) => row.id),
  );
  return withAncestors(rows, matches).map((row) => toTender(row));
}

export async function getTender(userId: string, tenderId: string): Promise<Tender> {
  const row = await findTenderById(userId, tenderId);
  if (!row) {
    throw notFound(NOT_FOUND);
  }
  return toTender(row);
}

export async function createTenderItem(
  userId: string,
  input: NewTenderInput,
): Promise<CreatedTender> {
  const name = (input.name && cleanName(input.name)) || DEFAULT_NAME;
  const subfolderName = input.subfolderName ? cleanName(input.subfolderName) : null;
  const parentId = input.parentId ?? null;
  if (parentId !== null && !(await findTenderById(userId, parentId))) {
    throw notFound(NOT_FOUND);
  }
  const [companies, templates] = await Promise.all([
    findCompaniesByUser(userId),
    findTemplatesByUser(userId),
  ]);
  const companyId = companies[0]?.id ?? null;
  const templateId = templates[0]?.id ?? null;
  return db.transaction(async (tx) => {
    const row = await createTender(userId, { parentId, name, companyId, templateId }, tx);
    const sub = subfolderName
      ? await createTender(
          userId,
          { parentId: row.id, name: subfolderName, companyId, templateId },
          tx,
        )
      : null;
    return { tender: toTender(row), subfolder: sub ? toTender(sub) : null };
  });
}

function cleanValues(values: Record<string, string>): Record<string, string> {
  const clean: Record<string, string> = {};
  for (const [rawKey, value] of Object.entries(values)) {
    const key = rawKey.normalize("NFC").replace(/\s+/g, " ").trim();
    if (key !== "") clean[key] = value.normalize("NFC");
  }
  return clean;
}

async function checkedChanges(
  userId: string,
  update: TenderUpdate,
  currentTemplateId: string | null,
): Promise<TenderChanges> {
  const changes: TenderChanges = {};
  if (update.parentId !== undefined) changes.parentId = update.parentId;
  if (update.editingPdfId === null) changes.editingPdfId = null;
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
    changes.editingPdfId = null;
  }
  if (update.templateId !== undefined) {
    if (update.templateId !== null && !(await findTemplateById(userId, update.templateId))) {
      throw notFound("Template not found.");
    }
    changes.templateId = update.templateId;
    changes.editingPdfId = null;
  }
  if (update.values !== undefined) changes.values = cleanValues(update.values);
  if (update.customHtml !== undefined) changes.customHtml = update.customHtml;
  if (update.canvas !== undefined) changes.canvas = update.canvas;
  if (changes.templateId !== undefined && changes.templateId !== currentTemplateId) {
    changes.customHtml = null;
  }
  return changes;
}

export async function updateTender(
  userId: string,
  tenderId: string,
  update: TenderUpdate,
): Promise<Tender> {
  const current = await findTenderById(userId, tenderId);
  if (!current) {
    throw notFound(NOT_FOUND);
  }
  const changes = await checkedChanges(userId, update, current.templateId);
  if (changes.parentId === undefined) {
    const row = await updateTenderRow(userId, tenderId, changes);
    if (!row) {
      throw notFound(NOT_FOUND);
    }
    return toTender(row);
  }
  const parentId = changes.parentId;
  return db.transaction(async (tx) => {
    await lockFoldersOfUser(userId, tx);
    const rows = await findAllTendersByUser(userId, tx);
    if (!rows.some((row) => row.id === tenderId)) {
      throw notFound(NOT_FOUND);
    }
    if (parentId !== null) {
      if (!rows.some((row) => row.id === parentId)) {
        throw notFound(NOT_FOUND);
      }
      if (parentId === tenderId || descendantIds(rows, tenderId).has(parentId)) {
        throw invalid(LOOP);
      }
    }
    const row = await updateTenderRow(userId, tenderId, changes, tx);
    if (!row) {
      throw notFound(NOT_FOUND);
    }
    return toTender(row);
  });
}

export async function deleteTender(userId: string, tenderId: string): Promise<void> {
  const rows = await findAllTendersByUser(userId);
  const owned = rows.some((row) => row.id === tenderId);
  const ids = owned ? [tenderId, ...descendantIds(rows, tenderId)] : [];
  const [imageKeys, pdfKeys] = await Promise.all([
    findImageKeysOfTenders(ids),
    findSavedPdfKeysOfTenders(ids),
  ]);
  const removed = await removeTender(userId, tenderId);
  if (!removed) {
    throw notFound(NOT_FOUND);
  }
  await Promise.all(
    [...imageKeys, ...pdfKeys].map((key) =>
      storage.delete(key).catch((error: unknown) => reportError(error)),
    ),
  );
}
