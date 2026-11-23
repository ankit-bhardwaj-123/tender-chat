import { findCompanyById, findCompanyFile } from "@/repositories/company.repository";
import { findSavedPdf, findSavedPdfFiles } from "@/repositories/saved-pdf.repository";
import { findTemplateById } from "@/repositories/template.repository";
import { findTenderImage } from "@/repositories/tender-image.repository";
import { storage } from "@/server/adapters/file-storage";
import { isReadablePdf } from "@/server/adapters/pdf-printer";
import { invalid, isAppError, notFound, unavailable } from "@/server/errors";
import { reportError } from "@/server/report-error";
import type { Tender } from "@/types";

export interface PartFile {
  bytes: Uint8Array;
  contentType: string;
  fileName: string;
}

export interface PdfParts {
  source: string;
  letterhead: PartFile;
  seal: PartFile | null;
  images: Record<string, PartFile>;
  fontKey: string | null;
  companyId: string | null;
  templateId: string | null;
  companyName: string;
  templateName: string;
}

const PICK_FIRST = "Pick a company and a template first.";
const NO_LETTERHEAD = "The letterhead file is missing. Upload it again in Companies.";
const BAD_LETTERHEAD = "The letterhead PDF can't be read. Upload it again in Companies.";
const COPY_FAILED = "This PDF can't be opened for editing.";

function reportUnexpected(error: unknown) {
  if (!isAppError(error)) reportError(error);
}

export async function readStored(key: string): Promise<Uint8Array> {
  return new Uint8Array(await (await storage.open(key)).arrayBuffer());
}

async function optionalFile(
  key: string,
  contentType: string,
  fileName: string,
): Promise<PartFile | null> {
  try {
    return { bytes: await readStored(key), contentType, fileName };
  } catch (error) {
    reportUnexpected(error);
    return null;
  }
}

async function checkedLetterhead(key: string, fileName: string): Promise<PartFile> {
  let bytes: Uint8Array;
  try {
    bytes = await readStored(key);
  } catch (error) {
    reportUnexpected(error);
    throw invalid(NO_LETTERHEAD);
  }
  if (!(await isReadablePdf(bytes))) throw invalid(BAD_LETTERHEAD);
  return { bytes, contentType: "application/pdf", fileName };
}

async function tenderImages(tender: Tender): Promise<Record<string, PartFile>> {
  const ids = [
    ...new Set(tender.canvas.items.flatMap((item) => (item.imageId ? [item.imageId] : []))),
  ];
  const loaded = await Promise.all(
    ids.map(async (imageId) => {
      const row = await findTenderImage(tender.id, imageId);
      const file = row ? await optionalFile(row.storageKey, row.contentType, row.fileName) : null;
      return { imageId, file };
    }),
  );
  const images: Record<string, PartFile> = {};
  for (const { imageId, file } of loaded) {
    if (file) images[imageId] = file;
  }
  return images;
}

async function currentParts(userId: string, tender: Tender): Promise<PdfParts> {
  if (tender.companyId === null || tender.templateId === null) throw invalid(PICK_FIRST);
  const [company, template] = await Promise.all([
    findCompanyById(userId, tender.companyId),
    findTemplateById(userId, tender.templateId),
  ]);
  if (!company) throw notFound("Company not found.");
  if (!template) throw notFound("Template not found.");
  const letterheadRow = await findCompanyFile(company.id, "letterhead");
  if (!letterheadRow) throw invalid(NO_LETTERHEAD);
  const letterhead = await checkedLetterhead(letterheadRow.storageKey, letterheadRow.fileName);
  const source = tender.customHtml ?? (await (await storage.open(template.storageKey)).text());
  const sealRow = await findCompanyFile(company.id, "seal");
  const [seal, images] = await Promise.all([
    sealRow ? optionalFile(sealRow.storageKey, sealRow.contentType, sealRow.fileName) : null,
    tenderImages(tender),
  ]);
  return {
    source,
    letterhead,
    seal,
    images,
    fontKey: company.fontKey,
    companyId: company.id,
    templateId: template.id,
    companyName: company.name,
    templateName: template.name,
  };
}

async function savedParts(tender: Tender, pdfId: string): Promise<PdfParts> {
  const row = await findSavedPdf(tender.id, pdfId);
  if (!row?.snapshot) throw invalid(COPY_FAILED);
  const files = await findSavedPdfFiles([row.id]);
  const letterheadFile = files.find((file) => file.kind === "letterhead");
  const sealFile = files.find((file) => file.kind === "seal");
  const templateFile = files.find((file) => file.kind === "template");
  if (!letterheadFile) throw invalid(NO_LETTERHEAD);
  let source = tender.customHtml;
  if (source === null) {
    if (!templateFile) throw unavailable(COPY_FAILED);
    source = new TextDecoder().decode(await readStored(templateFile.storageKey));
  }
  const [letterhead, seal, images] = await Promise.all([
    checkedLetterhead(letterheadFile.storageKey, letterheadFile.fileName),
    sealFile ? optionalFile(sealFile.storageKey, sealFile.contentType, sealFile.fileName) : null,
    tenderImages(tender),
  ]);
  return {
    source,
    letterhead,
    seal,
    images,
    fontKey: row.snapshot.fontKey,
    companyId: row.snapshot.companyId,
    templateId: row.snapshot.templateId,
    companyName: row.companyName,
    templateName: row.templateName,
  };
}

export async function loadParts(userId: string, tender: Tender): Promise<PdfParts> {
  return tender.editingPdfId === null
    ? currentParts(userId, tender)
    : savedParts(tender, tender.editingPdfId);
}

export function dataUrlOf(file: PartFile): string {
  return `data:${file.contentType};base64,${Buffer.from(file.bytes).toString("base64")}`;
}
