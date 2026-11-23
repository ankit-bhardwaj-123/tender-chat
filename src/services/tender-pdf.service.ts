import { pdfPageCount, printHtmlToPdf, stackPages } from "@/server/adapters/pdf-printer";
import { printFontUrl } from "@/server/adapters/print-font";
import { canvasPagesHtml } from "@/shared/canvas";
import { fontOverrideCss } from "@/shared/fill-template";
import { fontFaceCss, fontOf, fontStack } from "@/shared/fonts";
import { pageDocument } from "@/shared/page-document";
import { getTender } from "@/services/tender.service";
import type { Tender } from "@/types";
import { dataUrlOf, loadParts, type PdfParts } from "./pdf-parts.service";

export interface TenderPdf {
  fileName: string;
  bytes: Uint8Array;
  tender: Tender;
  parts: PdfParts;
}

const PRINT_CSS = "@page{size:A4;margin:0}html{overflow:visible}[data-empty]{visibility:hidden}";

function pdfFileName(name: string): string {
  const clean = name.replace(/[\u0000-\u001f\u007f/\\:*?"<>|]/g, "").trim();
  return `${clean === "" ? "Quotation" : clean}.pdf`;
}

export async function makeTenderPdf(
  userId: string,
  tenderId: string,
  sealTop: number | null,
): Promise<TenderPdf> {
  const tender = await getTender(userId, tenderId);
  const parts = await loadParts(userId, tender);
  const imageUrls: Record<string, string> = {};
  for (const [imageId, file] of Object.entries(parts.images)) imageUrls[imageId] = dataUrlOf(file);

  const font = fontOf(parts.fontKey);
  const fontUrl = await printFontUrl(font);
  const content = await printHtmlToPdf(
    pageDocument(parts.source, tender.values, font.key, fontUrl, PRINT_CSS),
  );
  const overlay = await printHtmlToPdf(
    canvasPagesHtml({
      canvas: tender.canvas,
      sealTop,
      sealUrl: parts.seal ? dataUrlOf(parts.seal) : null,
      imageUrls,
      fontCss: fontOverrideCss(fontStack(font), fontFaceCss(fontUrl, font)),
      fontStack: fontStack(font),
      pageCount: await pdfPageCount(content),
    }),
  );
  const bytes = await stackPages(content, overlay, parts.letterhead.bytes);
  return { fileName: pdfFileName(tender.name), bytes, tender, parts };
}
