import { findCompanyById, findCompanyFile } from "@/repositories/company.repository";
import { findTemplateById } from "@/repositories/template.repository";
import { findTenderImage } from "@/repositories/tender-image.repository";
import { storage } from "@/server/adapters/file-storage";
import {
  isReadablePdf,
  pdfPageCount,
  printHtmlToPdf,
  stackPages,
} from "@/server/adapters/pdf-printer";
import { printFontUrl } from "@/server/adapters/print-font";
import { invalid, isAppError, notFound } from "@/server/errors";
import { reportError } from "@/server/report-error";
import { canvasPagesHtml } from "@/shared/canvas";
import { fontOverrideCss } from "@/shared/fill-template";
import { fontFaceCss, fontOf, fontStack } from "@/shared/fonts";
import { pageDocument } from "@/shared/page-document";
import { getTender } from "@/services/tender.service";

export interface TenderPdf {
  fileName: string;
  bytes: Uint8Array;
}

const PICK_FIRST = "Pick a company and a template first.";
const NO_LETTERHEAD = "The letterhead file is missing. Upload it again in Companies.";
const BAD_LETTERHEAD = "The letterhead PDF can't be read. Upload it again in Companies.";
const PRINT_CSS = "@page{size:A4;margin:0}html{overflow:visible}[data-empty]{visibility:hidden}";

function pdfFileName(name: string): string {
  const clean = name.replace(/[\u0000-\u001f\u007f/\\:*?"<>|]/g, "").trim();
  return `${clean === "" ? "Quotation" : clean}.pdf`;
}

function reportUnexpected(error: unknown) {
  if (!isAppError(error)) reportError(error);
}

async function readBytes(key: string): Promise<Uint8Array> {
  return new Uint8Array(await (await storage.open(key)).arrayBuffer());
}

async function dataUrl(key: string, contentType: string): Promise<string | null> {
  try {
    const bytes = await readBytes(key);
    return `data:${contentType};base64,${Buffer.from(bytes).toString("base64")}`;
  } catch (error) {
    reportUnexpected(error);
    return null;
  }
}

async function letterheadBytes(companyId: string): Promise<Uint8Array> {
  const row = await findCompanyFile(companyId, "letterhead");
  if (!row) throw invalid(NO_LETTERHEAD);
  let bytes: Uint8Array;
  try {
    bytes = await readBytes(row.storageKey);
  } catch (error) {
    reportUnexpected(error);
    throw invalid(NO_LETTERHEAD);
  }
  if (!(await isReadablePdf(bytes))) throw invalid(BAD_LETTERHEAD);
  return bytes;
}

async function sealUrl(companyId: string): Promise<string | null> {
  const row = await findCompanyFile(companyId, "seal");
  return row ? dataUrl(row.storageKey, row.contentType) : null;
}

async function imageUrls(tenderId: string, imageIds: string[]): Promise<Record<string, string>> {
  const loaded = await Promise.all(
    [...new Set(imageIds)].map(async (imageId) => {
      const row = await findTenderImage(tenderId, imageId);
      const url = row ? await dataUrl(row.storageKey, row.contentType) : null;
      return { imageId, url };
    }),
  );
  const urls: Record<string, string> = {};
  for (const { imageId, url } of loaded) {
    if (url) urls[imageId] = url;
  }
  return urls;
}

export async function makeTenderPdf(
  userId: string,
  tenderId: string,
  sealTop: number | null,
): Promise<TenderPdf> {
  const tender = await getTender(userId, tenderId);
  if (tender.companyId === null || tender.templateId === null) throw invalid(PICK_FIRST);
  const [company, template] = await Promise.all([
    findCompanyById(userId, tender.companyId),
    findTemplateById(userId, tender.templateId),
  ]);
  if (!company) throw notFound("Company not found.");
  if (!template) throw notFound("Template not found.");

  const letterhead = await letterheadBytes(company.id);
  const source = tender.customHtml ?? (await (await storage.open(template.storageKey)).text());
  const imageIds = tender.canvas.items.flatMap((item) => (item.imageId ? [item.imageId] : []));
  const [seal, images] = await Promise.all([sealUrl(company.id), imageUrls(tender.id, imageIds)]);

  const font = fontOf(company.fontKey);
  const fontUrl = await printFontUrl(font);
  const content = await printHtmlToPdf(
    pageDocument(source, tender.values, font.key, fontUrl, PRINT_CSS),
  );
  const overlay = await printHtmlToPdf(
    canvasPagesHtml({
      canvas: tender.canvas,
      sealTop,
      sealUrl: seal,
      imageUrls: images,
      fontCss: fontOverrideCss(fontStack(font), fontFaceCss(fontUrl, font)),
      fontStack: fontStack(font),
      pageCount: await pdfPageCount(content),
    }),
  );
  const bytes = await stackPages(content, overlay, letterhead);
  return { fileName: pdfFileName(tender.name), bytes };
}
