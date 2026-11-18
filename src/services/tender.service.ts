import {
  createTender,
  findAllTendersByUser,
  findTenderById,
  removeTender,
  updateTenderName,
} from "@/repositories/tender.repository";
import { invalid, notFound } from "@/server/errors";
import { toTender } from "@/shared/dto";
import type { Tender } from "@/types";

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
  const row = await createTender(userId, name);
  return toTender(row);
}

export async function renameTender(
  userId: string,
  tenderId: string,
  rawName: string,
): Promise<Tender> {
  const name = cleanName(rawName);
  if (!name) {
    throw invalid(`A name must be 1–${NAME_MAX_LENGTH} characters.`);
  }
  const row = await updateTenderName(userId, tenderId, name);
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
