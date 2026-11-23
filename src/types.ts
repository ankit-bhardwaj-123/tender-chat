export interface User {
  id: string;
  name: string;
  email: string;
  image: string | null;
}

export interface Session {
  user: User;
}

export type TenderType = "quotation";

export interface Tender {
  id: string;
  parentId: string | null;
  editingPdfId: string | null;
  name: string;
  type: TenderType;
  companyId: string | null;
  templateId: string | null;
  values: Record<string, string>;
  customHtml: string | null;
  canvas: TenderCanvas;
  createdAt: string;
  updatedAt: string;
}

export interface CreatedTender {
  tender: Tender;
  subfolder: Tender | null;
}

export type CanvasItemKind = "text" | "image";

export interface CanvasItem {
  id: string;
  kind: CanvasItemKind;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  imageId: string | null;
}

export interface CanvasSeal {
  shown: boolean;
  x: number | null;
  y: number | null;
  width: number;
}

export interface TenderCanvas {
  items: CanvasItem[];
  seal: CanvasSeal;
}

export interface SavedPdf {
  id: string;
  name: string;
  companyName: string;
  templateName: string;
  editable: boolean;
  fontKey: string | null;
  hasLetterhead: boolean;
  hasSeal: boolean;
  createdAt: string;
  editedAt: string | null;
}

export interface SavedPdfSnapshot {
  companyId: string | null;
  templateId: string | null;
  fontKey: string | null;
  values: Record<string, string>;
  canvas: TenderCanvas;
}

export interface TenderImage {
  id: string;
  fileName: string;
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
  fontKey: string | null;
  files: CompanyFiles;
  createdAt: string;
  updatedAt: string;
}

export interface UploadRef {
  key: string;
  fileName: string;
}

export type UploadKind = "companyFile" | "template" | "tenderImage";

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
