import {
  type CompanyChanges,
  deleteCompanyFile,
  findCompaniesByUser,
  findCompanyById,
  findCompanyFile,
  findFilesOfCompanies,
  insertCompany,
  lockCompany,
  lockCompanyFile,
  updateCompany as updateCompanyRow,
  upsertCompanyFile,
  voidCompany,
} from "@/repositories/company.repository";
import { storage } from "@/server/adapters/file-storage";
import { db } from "@/server/adapters/postgres";
import { invalid, notFound } from "@/server/errors";
import { reportError } from "@/server/report-error";
import { toCompany } from "@/shared/dto";
import {
  discardUpload,
  readUploadHead,
  UPLOAD_LIMITS,
  type UploadedFile,
} from "@/services/upload.service";
import type { Company, CompanyFileKind } from "@/types";

export interface OpenedCompanyFile {
  fileName: string;
  contentType: string;
  size: number;
  file: ReadableStream<Uint8Array>;
}

interface FileRule {
  signature: readonly number[];
  contentType: string;
  wrongType: string;
}

const NOT_FOUND = "Company not found.";
const FILE_NOT_FOUND = "File not found.";
const FILE_NAME_MAX_LENGTH = 200;
const MAX_FILE_BYTES = UPLOAD_LIMITS.companyFile.maxBytes;

const FILE_RULES: Record<CompanyFileKind, FileRule> = {
  letterhead: {
    signature: [0x25, 0x50, 0x44, 0x46, 0x2d],
    contentType: "application/pdf",
    wrongType: "Letterhead must be a PDF.",
  },
  seal: {
    signature: [0xff, 0xd8, 0xff],
    contentType: "image/jpeg",
    wrongType: "Seal must be a JPG.",
  },
};

function cleanFileName(raw: string): string {
  const name = raw
    .normalize("NFC")
    .replace(/[\p{Cc}/\\]/gu, "")
    .trim();
  if (name === "") return "file";
  return name.length > FILE_NAME_MAX_LENGTH ? name.slice(-FILE_NAME_MAX_LENGTH) : name;
}

async function checkFileType(upload: UploadedFile, kind: CompanyFileKind): Promise<string> {
  if (upload.size === 0) {
    throw invalid("The file is empty.");
  }
  if (upload.size > MAX_FILE_BYTES) {
    throw invalid(`A file must be at most ${MAX_FILE_BYTES / 1024 / 1024} MB.`);
  }
  const rule = FILE_RULES[kind];
  const head = await readUploadHead(upload, rule.signature.length);
  if (!rule.signature.every((byte, index) => head[index] === byte)) {
    throw invalid(rule.wrongType);
  }
  return rule.contentType;
}

async function removeStoredFile(storageKey: string): Promise<void> {
  await storage.delete(storageKey).catch((error: unknown) => reportError(error));
}

async function ownedCompany(userId: string, companyId: string): Promise<Company> {
  const row = await findCompanyById(userId, companyId);
  if (!row) {
    throw notFound(NOT_FOUND);
  }
  return toCompany(row, await findFilesOfCompanies([row.id]));
}

export function isCompanyFileKind(value: string): value is CompanyFileKind {
  return Object.hasOwn(FILE_RULES, value);
}

export async function listCompanies(userId: string): Promise<Company[]> {
  const rows = await findCompaniesByUser(userId);
  const files = await findFilesOfCompanies(rows.map((row) => row.id));
  return rows.map((row) => toCompany(row, files));
}

export async function getCompany(userId: string, companyId: string): Promise<Company> {
  return ownedCompany(userId, companyId);
}

export async function createCompany(
  userId: string,
  name: string,
  fontKey: string | null,
): Promise<Company> {
  const row = await insertCompany(userId, name, fontKey);
  return toCompany(row, []);
}

export async function updateCompany(
  userId: string,
  companyId: string,
  changes: CompanyChanges,
): Promise<Company> {
  const row = await updateCompanyRow(userId, companyId, changes);
  if (!row) {
    throw notFound(NOT_FOUND);
  }
  return toCompany(row, await findFilesOfCompanies([row.id]));
}

export async function deleteCompany(userId: string, companyId: string): Promise<void> {
  const voided = await voidCompany(userId, companyId);
  if (!voided) {
    throw notFound(NOT_FOUND);
  }
}

export async function uploadCompanyFile(
  userId: string,
  companyId: string,
  kind: CompanyFileKind,
  upload: UploadedFile,
): Promise<Company> {
  let previousKey: string | null = null;
  try {
    if (!(await findCompanyById(userId, companyId))) {
      throw notFound(NOT_FOUND);
    }
    const contentType = await checkFileType(upload, kind);
    await db.transaction(async (tx) => {
      if (!(await lockCompany(userId, companyId, tx))) {
        throw notFound(NOT_FOUND);
      }
      const previous = await lockCompanyFile(companyId, kind, tx);
      previousKey = previous?.storageKey ?? null;
      await upsertCompanyFile(
        companyId,
        {
          kind,
          storageKey: upload.key,
          fileName: cleanFileName(upload.fileName),
          contentType,
          sizeBytes: upload.size,
        },
        tx,
      );
    });
  } catch (error) {
    await discardUpload(upload);
    throw error;
  }

  if (previousKey) await removeStoredFile(previousKey);
  return ownedCompany(userId, companyId);
}

export async function openCompanyFile(
  userId: string,
  companyId: string,
  kind: CompanyFileKind,
): Promise<OpenedCompanyFile> {
  const owned = await findCompanyById(userId, companyId);
  const row = owned ? await findCompanyFile(companyId, kind) : null;
  if (!row) {
    throw notFound(FILE_NOT_FOUND);
  }
  const size = await storage.size(row.storageKey);
  const file = await storage.read(row.storageKey, null);
  return { fileName: row.fileName, contentType: row.contentType, size, file };
}

export async function removeCompanyFile(
  userId: string,
  companyId: string,
  kind: CompanyFileKind,
): Promise<Company> {
  if (!(await findCompanyById(userId, companyId))) {
    throw notFound(NOT_FOUND);
  }
  const storageKey = await deleteCompanyFile(companyId, kind);
  if (!storageKey) {
    throw notFound(FILE_NOT_FOUND);
  }
  await removeStoredFile(storageKey);
  return ownedCompany(userId, companyId);
}
