import { randomUUID } from "node:crypto";
import {
  findSavedPdf,
  findSavedPdfFiles,
  findSavedPdfNames,
  findSavedPdfsOfTender,
  insertSavedPdf,
  insertSavedPdfFiles,
  type NewSavedPdfFile,
  replaceSavedPdf,
  type SavedPdfFileRow,
  type SavedPdfRow,
} from "@/repositories/saved-pdf.repository";
import { findCompanyById } from "@/repositories/company.repository";
import { findTemplateById } from "@/repositories/template.repository";
import { findTenderImage, insertTenderImageWithId } from "@/repositories/tender-image.repository";
import { findTenderById, lockTender, updateTender } from "@/repositories/tender.repository";
import { storage } from "@/server/adapters/file-storage";
import { db } from "@/server/adapters/postgres";
import { invalid, isAppError, notFound, unavailable } from "@/server/errors";
import { reportError } from "@/server/report-error";
import { toSavedPdf, toTender } from "@/shared/dto";
import { SAVE_FAILED } from "@/shared/pdf-body";
import { nextPdfName } from "@/shared/pdf-name";
import type { SavedPdf, SavedPdfSnapshot, Tender } from "@/types";
import type { PartFile } from "./pdf-parts.service";
import { readStored } from "./pdf-parts.service";
import { makeTenderPdf, type TenderPdf } from "./tender-pdf.service";

export interface SavedPdfFile {
  fileName: string;
  contentType: string;
  size: number;
  file: ReadableStream<Uint8Array>;
}

export type SavedPdfPart = "letterhead" | "seal";

const TENDER_NOT_FOUND = "Tender not found.";
const PDF_NOT_FOUND = "This PDF can't be found.";
const OLD_PDF = "Saved before editing was possible.";
const COPY_FAILED = "This PDF can't be opened for editing.";
const NAME_MAX_LENGTH = 200;

interface StoredPdf {
  pdfKey: string;
  files: NewSavedPdfFile[];
  keys: string[];
}

function fileNameOf(name: string): string {
  const clean = name.replace(/[\u0000-\u001f\u007f/\\:*?"<>|]/g, "").trim();
  return `${clean === "" ? "Quotation" : clean}.pdf`;
}

function cleanName(raw: string | undefined): string | null {
  const name = (raw ?? "").normalize("NFC").replace(/\s+/g, " ").trim();
  if (name === "") return null;
  return name.slice(0, NAME_MAX_LENGTH);
}

function extensionOf(contentType: string): string {
  if (contentType === "application/pdf") return "pdf";
  if (contentType === "image/png") return "png";
  if (contentType.startsWith("text/html")) return "html";
  return "jpg";
}

function partKinds(files: SavedPdfFileRow[], pdfId: string) {
  const own = files.filter((file) => file.savedPdfId === pdfId);
  return {
    letterhead: own.some((file) => file.kind === "letterhead"),
    seal: own.some((file) => file.kind === "seal"),
  };
}

function snapshotOf(pdf: TenderPdf): SavedPdfSnapshot {
  return {
    companyId: pdf.parts.companyId,
    templateId: pdf.parts.templateId,
    fontKey: pdf.parts.fontKey,
    values: pdf.tender.values,
    canvas: pdf.tender.canvas,
  };
}

async function storeFile(userId: string, file: PartFile, keys: string[]): Promise<string> {
  const key = `uploads/${userId}/${randomUUID()}.${extensionOf(file.contentType)}`;
  keys.push(key);
  await storage.save(key, new Blob([Buffer.from(file.bytes)], { type: file.contentType }));
  return key;
}

async function storePdf(userId: string, pdf: TenderPdf): Promise<StoredPdf> {
  const keys: string[] = [];
  try {
    const pdfKey = await storeFile(
      userId,
      { bytes: pdf.bytes, contentType: "application/pdf", fileName: pdf.fileName },
      keys,
    );
    const template: PartFile = {
      bytes: new TextEncoder().encode(pdf.parts.source),
      contentType: "text/html; charset=utf-8",
      fileName: "template.html",
    };
    const parts: { kind: NewSavedPdfFile["kind"]; imageId: string | null; file: PartFile }[] = [
      { kind: "letterhead", imageId: null, file: pdf.parts.letterhead },
      { kind: "template", imageId: null, file: template },
    ];
    if (pdf.parts.seal) parts.push({ kind: "seal", imageId: null, file: pdf.parts.seal });
    for (const [imageId, file] of Object.entries(pdf.parts.images)) {
      parts.push({ kind: "image", imageId, file });
    }
    const files = await Promise.all(
      parts.map(async (part) => ({
        kind: part.kind,
        imageId: part.imageId,
        storageKey: await storeFile(userId, part.file, keys),
        fileName: part.file.fileName,
        contentType: part.file.contentType,
        sizeBytes: part.file.bytes.byteLength,
      })),
    );
    return { pdfKey, files, keys };
  } catch (error) {
    await removeKeys(keys);
    throw error;
  }
}

async function removeKeys(keys: string[]): Promise<void> {
  await Promise.all(keys.map((key) => storage.delete(key).catch(() => undefined)));
}

async function withFiles(row: SavedPdfRow): Promise<SavedPdf> {
  return toSavedPdf(row, partKinds(await findSavedPdfFiles([row.id]), row.id));
}

function saveError(error: unknown): unknown {
  if (isAppError(error) && error.kind === "not_found") return error;
  return unavailable(SAVE_FAILED, error);
}

export async function saveTenderPdf(
  userId: string,
  tenderId: string,
  sealTop: number | null,
  rawName?: string,
): Promise<SavedPdf> {
  const pdf = await makeTenderPdf(userId, tenderId, sealTop);
  let stored: StoredPdf | null = null;
  try {
    stored = await storePdf(userId, pdf);
    const { pdfKey, files } = stored;
    const row = await db.transaction(async (tx) => {
      const locked = await lockTender(userId, tenderId, tx);
      if (!locked) {
        throw notFound(TENDER_NOT_FOUND);
      }
      const name =
        cleanName(rawName) ??
        nextPdfName(pdf.parts.companyName, await findSavedPdfNames(tenderId, tx));
      const inserted = await insertSavedPdf(
        {
          tenderId,
          name,
          companyName: pdf.parts.companyName,
          templateName: pdf.parts.templateName,
          storageKey: pdfKey,
          sizeBytes: pdf.bytes.byteLength,
          snapshot: snapshotOf(pdf),
        },
        tx,
      );
      await insertSavedPdfFiles(inserted.id, files, tx);
      if (locked.editingPdfId !== null) {
        await updateTender(userId, tenderId, { editingPdfId: inserted.id }, tx);
      }
      return inserted;
    });
    return await withFiles(row);
  } catch (error) {
    if (stored) await removeKeys(stored.keys);
    throw saveError(error);
  }
}

export async function replaceTenderPdf(
  userId: string,
  tenderId: string,
  pdfId: string,
  sealTop: number | null,
  rawName?: string,
): Promise<SavedPdf> {
  const owned = await findTenderById(userId, tenderId);
  const existing = owned ? await findSavedPdf(tenderId, pdfId) : null;
  if (!existing) {
    throw notFound(PDF_NOT_FOUND);
  }
  const pdf = await makeTenderPdf(userId, tenderId, sealTop);
  let stored: StoredPdf | null = null;
  let oldKeys: string[] = [];
  let row: SavedPdfRow;
  try {
    stored = await storePdf(userId, pdf);
    const { pdfKey, files } = stored;
    row = await db.transaction(async (tx) => {
      if (!(await lockTender(userId, tenderId, tx))) {
        throw notFound(TENDER_NOT_FOUND);
      }
      const current = await findSavedPdf(tenderId, pdfId, tx);
      if (!current) {
        throw notFound(PDF_NOT_FOUND);
      }
      const replaced = await replaceSavedPdf(
        pdfId,
        {
          name: cleanName(rawName) ?? current.name,
          companyName: pdf.parts.companyName,
          templateName: pdf.parts.templateName,
          storageKey: pdfKey,
          sizeBytes: pdf.bytes.byteLength,
          snapshot: snapshotOf(pdf),
        },
        files,
        tx,
      );
      if (!replaced) {
        throw notFound(PDF_NOT_FOUND);
      }
      oldKeys = replaced.oldKeys;
      return replaced.row;
    });
  } catch (error) {
    if (stored) await removeKeys(stored.keys);
    throw saveError(error);
  }
  await Promise.all(
    oldKeys.map((key) => storage.delete(key).catch((error: unknown) => reportError(error))),
  );
  return withFiles(row);
}

export async function editSavedPdf(
  userId: string,
  tenderId: string,
  pdfId: string,
): Promise<Tender> {
  const owned = await findTenderById(userId, tenderId);
  const row = owned ? await findSavedPdf(tenderId, pdfId) : null;
  if (!row) {
    throw notFound(PDF_NOT_FOUND);
  }
  const snapshot = row.snapshot;
  if (!snapshot) {
    throw invalid(OLD_PDF);
  }
  const files = await findSavedPdfFiles([row.id]);
  const templateFile = files.find((file) => file.kind === "template");
  const copied: string[] = [];
  try {
    if (!templateFile) throw new Error("Saved PDF has no template copy");
    const source = new TextDecoder().decode(await readStored(templateFile.storageKey));
    const [company, template] = await Promise.all([
      snapshot.companyId ? findCompanyById(userId, snapshot.companyId) : null,
      snapshot.templateId ? findTemplateById(userId, snapshot.templateId) : null,
    ]);
    const updated = await db.transaction(async (tx) => {
      if (!(await lockTender(userId, tenderId, tx))) {
        throw notFound(TENDER_NOT_FOUND);
      }
      for (const file of files) {
        if (file.kind !== "image" || file.imageId === null) continue;
        if (await findTenderImage(tenderId, file.imageId, tx)) continue;
        const key = `uploads/${userId}/${randomUUID()}.${extensionOf(file.contentType)}`;
        copied.push(key);
        await storage.save(key, await storage.open(file.storageKey));
        await insertTenderImageWithId(
          file.imageId,
          {
            tenderId,
            storageKey: key,
            fileName: file.fileName,
            contentType: file.contentType,
            sizeBytes: file.sizeBytes,
          },
          tx,
        );
      }
      return updateTender(
        userId,
        tenderId,
        {
          companyId: company?.id ?? null,
          templateId: template?.id ?? null,
          values: snapshot.values,
          customHtml: source,
          canvas: snapshot.canvas,
          editingPdfId: row.id,
        },
        tx,
      );
    });
    if (!updated) {
      throw notFound(TENDER_NOT_FOUND);
    }
    return toTender(updated);
  } catch (error) {
    await removeKeys(copied);
    if (isAppError(error)) throw error;
    throw unavailable(COPY_FAILED, error);
  }
}

export async function listSavedPdfs(userId: string, tenderId: string): Promise<SavedPdf[]> {
  if (!(await findTenderById(userId, tenderId))) {
    throw notFound(TENDER_NOT_FOUND);
  }
  const rows = await findSavedPdfsOfTender(tenderId);
  const files = await findSavedPdfFiles(rows.map((row) => row.id));
  return rows.map((row) => toSavedPdf(row, partKinds(files, row.id)));
}

async function streamOf(key: string, fileName: string, contentType: string): Promise<SavedPdfFile> {
  try {
    const size = await storage.size(key);
    const file = await storage.read(key, null);
    return { fileName, contentType, size, file };
  } catch (error) {
    reportError(error);
    throw notFound(PDF_NOT_FOUND);
  }
}

export async function openSavedPdf(
  userId: string,
  tenderId: string,
  pdfId: string,
): Promise<SavedPdfFile> {
  const owned = await findTenderById(userId, tenderId);
  const row = owned ? await findSavedPdf(tenderId, pdfId) : null;
  if (!row) {
    throw notFound(PDF_NOT_FOUND);
  }
  return streamOf(row.storageKey, fileNameOf(row.name), "application/pdf");
}

export async function openSavedPdfPart(
  userId: string,
  tenderId: string,
  pdfId: string,
  kind: SavedPdfPart,
): Promise<SavedPdfFile> {
  const owned = await findTenderById(userId, tenderId);
  const row = owned ? await findSavedPdf(tenderId, pdfId) : null;
  const file = row
    ? (await findSavedPdfFiles([row.id])).find((item) => item.kind === kind)
    : undefined;
  if (!file) {
    throw notFound(PDF_NOT_FOUND);
  }
  return streamOf(file.storageKey, file.fileName, file.contentType);
}
