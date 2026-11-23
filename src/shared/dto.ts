import type {
  Company,
  CompanyFile,
  CompanyFileKind,
  SavedPdf,
  SavedPdfSnapshot,
  Template,
  TemplateLanguage,
  Tender,
  TenderImage,
  TenderType,
} from "@/types";
import { readCanvas } from "@/shared/canvas";
import { isFontKey } from "@/shared/fonts";

export interface TenderDbRow {
  id: string;
  parentId: string | null;
  editingPdfId: string | null;
  name: string;
  type: TenderType;
  companyId: string | null;
  templateId: string | null;
  values: Record<string, string> | null;
  customHtml: string | null;
  canvas: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export function toTender(row: TenderDbRow): Tender {
  return {
    id: row.id,
    parentId: row.parentId,
    editingPdfId: row.editingPdfId,
    name: row.name,
    type: row.type,
    companyId: row.companyId,
    templateId: row.templateId,
    values: row.values ?? {},
    customHtml: row.customHtml,
    canvas: readCanvas(row.canvas),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export interface CompanyDbRow {
  id: string;
  name: string;
  fontKey: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CompanyFileDbRow {
  companyId: string;
  kind: CompanyFileKind;
  fileName: string;
  sizeBytes: number;
  createdAt: Date;
}

function toCompanyFile(file: CompanyFileDbRow | undefined): CompanyFile | null {
  if (!file) return null;
  return {
    fileName: file.fileName,
    size: file.sizeBytes,
    uploadedAt: file.createdAt.toISOString(),
  };
}

export function toCompany(row: CompanyDbRow, files: readonly CompanyFileDbRow[]): Company {
  const own = files.filter((file) => file.companyId === row.id);
  return {
    id: row.id,
    name: row.name,
    fontKey: isFontKey(row.fontKey) ? row.fontKey : null,
    files: {
      letterhead: toCompanyFile(own.find((file) => file.kind === "letterhead")),
      seal: toCompanyFile(own.find((file) => file.kind === "seal")),
    },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export interface TemplateDbRow {
  id: string;
  name: string;
  language: TemplateLanguage;
  fileName: string;
  sizeBytes: number;
  placeholders: string[];
  createdAt: Date;
  updatedAt: Date;
}

export function toTemplate(row: TemplateDbRow): Template {
  return {
    id: row.id,
    name: row.name,
    language: row.language,
    fileName: row.fileName,
    size: row.sizeBytes,
    placeholders: row.placeholders,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export interface TenderImageDbRow {
  id: string;
  fileName: string;
}

export function toTenderImage(row: TenderImageDbRow): TenderImage {
  return { id: row.id, fileName: row.fileName };
}

export interface SavedPdfDbRow {
  id: string;
  name: string;
  companyName: string;
  templateName: string;
  snapshot: SavedPdfSnapshot | null;
  createdAt: Date;
  editedAt: Date | null;
}

export interface SavedPdfPartKinds {
  letterhead: boolean;
  seal: boolean;
}

export function toSavedPdf(row: SavedPdfDbRow, parts: SavedPdfPartKinds): SavedPdf {
  return {
    id: row.id,
    name: row.name,
    companyName: row.companyName,
    templateName: row.templateName,
    editable: row.snapshot !== null,
    fontKey: row.snapshot?.fontKey ?? null,
    hasLetterhead: parts.letterhead,
    hasSeal: parts.seal,
    createdAt: row.createdAt.toISOString(),
    editedAt: row.editedAt ? row.editedAt.toISOString() : null,
  };
}
