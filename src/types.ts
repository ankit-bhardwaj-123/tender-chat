export interface User {
  id: string;
  name: string;
  email: string;
  image: string | null;
}

export interface Session {
  user: User;
}

export interface Tender {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export type CompanyFileKind = "letterhead" | "seal";

export interface CompanyFile {
  fileName: string;
  size: number;
  uploadedAt: string;
}

export interface CompanyFiles {
  letterhead: CompanyFile | null;
  seal: CompanyFile | null;
}

export interface Company {
  id: string;
  name: string;
  files: CompanyFiles;
  createdAt: string;
  updatedAt: string;
}

export interface UploadRef {
  key: string;
  fileName: string;
}

export type UploadKind = "companyFile" | "template";

export type TemplateLanguage = "hi" | "en";

export interface Template {
  id: string;
  name: string;
  language: TemplateLanguage;
  fileName: string;
  size: number;
  placeholders: string[];
  createdAt: string;
  updatedAt: string;
}
