import type { Company, CompanyFile, CompanyFileKind, Tender } from "@/types";

export interface TenderDbRow {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export function toTender(row: TenderDbRow): Tender {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export interface CompanyDbRow {
  id: string;
  name: string;
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
    files: {
      letterhead: toCompanyFile(own.find((file) => file.kind === "letterhead")),
      seal: toCompanyFile(own.find((file) => file.kind === "seal")),
    },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
