import { z } from "zod";
import type { CanvasItem, CanvasSeal, TenderCanvas } from "@/types";
import { escapeHtml } from "@/shared/fill-template";

export const PAGE_WIDTH_MM = 210;
export const PAGE_HEIGHT_MM = 297;
export const MIN_ITEM_MM = 5;
export const SEAL_WIDTH_MM = 35;
export const TEXT_BOX_WIDTH_MM = 70;
export const TEXT_BOX_HEIGHT_MM = 10;
export const IMAGE_WIDTH_MM = 45;
export const IMAGE_HEIGHT_MM = 30;
export const TEXT_BOX_FONT_PT = 12;
export const SEAL_MARGIN_MM = 25;

export const MAX_PDF_PAGES = 20;
export const MAX_CANVAS_ITEMS = 200;
export const MAX_TOP_MM = 297 * MAX_PDF_PAGES;

const size = z.number().min(0).max(100000);

const CanvasItemBody = z.object({
  id: z.string().min(1).max(64),
  kind: z.enum(["text", "image"]),
  x: size,
  y: size,
  width: size,
  height: size,
  text: z.string(),
  imageId: z.uuid().nullable(),
});

const SealBody = z.object({
  shown: z.boolean(),
  x: size.nullable(),
  y: size.nullable(),
  width: size,
});

const StoredCanvas = z.object({ items: z.array(CanvasItemBody), seal: SealBody });

export const CanvasBody = z.object({
  items: z.array(CanvasItemBody).max(MAX_CANVAS_ITEMS),
  seal: SealBody,
});

export function defaultCanvas(): TenderCanvas {
  return { items: [], seal: { shown: true, x: null, y: null, width: SEAL_WIDTH_MM } };
}

export function readCanvas(raw: unknown): TenderCanvas {
  const parsed = StoredCanvas.safeParse(raw);
  return parsed.success ? parsed.data : defaultCanvas();
}

export function keepOnSheet(item: CanvasItem): CanvasItem {
  const width = Math.min(PAGE_WIDTH_MM, Math.max(MIN_ITEM_MM, item.width));
  const height = Math.max(MIN_ITEM_MM, item.height);
  const x = Math.min(PAGE_WIDTH_MM - width, Math.max(0, item.x));
  const y = Math.max(0, item.y);
  return { ...item, x, y, width, height };
}

export function newTextBox(id: string, x: number, y: number): CanvasItem {
  return keepOnSheet({
    id,
    kind: "text",
    x,
    y,
    width: TEXT_BOX_WIDTH_MM,
    height: TEXT_BOX_HEIGHT_MM,
    text: "",
    imageId: null,
  });
}

export function newImage(id: string, imageId: string, x: number, y: number): CanvasItem {
  return keepOnSheet({
    id,
    kind: "image",
    x,
    y,
    width: IMAGE_WIDTH_MM,
    height: IMAGE_HEIGHT_MM,
    text: "",
    imageId,
  });
}

export interface CanvasPagesInput {
  canvas: TenderCanvas;
  sealTop: number | null;
  sealUrl: string | null;
  imageUrls: Record<string, string>;
  fontCss: string;
  fontStack: string;
  pageCount: number;
}

interface PlacedBlock {
  page: number;
  html: string;
}

export function sealLeft(seal: CanvasSeal): number {
  return seal.x ?? PAGE_WIDTH_MM - SEAL_MARGIN_MM - seal.width;
}

export function sealTopOf(seal: CanvasSeal, measuredTop: number | null): number {
  return seal.y ?? measuredTop ?? PAGE_HEIGHT_MM - SEAL_MARGIN_MM - seal.width;
}

function pageOf(y: number): number {
  return Math.floor(y / PAGE_HEIGHT_MM);
}

function placed(y: number, style: string, inner: string): PlacedBlock {
  const page = pageOf(y);
  const top = y - page * PAGE_HEIGHT_MM;
  return { page, html: `<div style="position:absolute;top:${top}mm;${style}">${inner}</div>` };
}

function itemBlock(item: CanvasItem, input: CanvasPagesInput): PlacedBlock | null {
  const box = `left:${item.x}mm;width:${item.width}mm;`;
  if (item.kind === "text") {
    const style = `${box}min-height:${item.height}mm;font-family:${escapeHtml(input.fontStack)};font-size:${TEXT_BOX_FONT_PT}pt;line-height:1.3;white-space:pre-wrap;overflow-wrap:break-word;color:#000;`;
    return placed(item.y, style, escapeHtml(item.text));
  }
  const url = item.imageId === null ? undefined : input.imageUrls[item.imageId];
  if (url === undefined) return null;
  const image = `<img src="${url}" alt="" style="display:block;width:100%;height:100%;object-fit:contain">`;
  return placed(item.y, `${box}height:${item.height}mm;`, image);
}

function sealBlock(input: CanvasPagesInput): PlacedBlock | null {
  const seal = input.canvas.seal;
  if (!seal.shown || input.sealUrl === null) return null;
  const image = `<img src="${input.sealUrl}" alt="" style="display:block;width:100%;height:auto">`;
  return placed(
    sealTopOf(seal, input.sealTop),
    `left:${sealLeft(seal)}mm;width:${seal.width}mm;`,
    image,
  );
}

function canvasBlocks(input: CanvasPagesInput): PlacedBlock[] {
  const blocks = input.canvas.items.map((item) => itemBlock(item, input));
  return [...blocks, sealBlock(input)].filter(
    (block): block is PlacedBlock => block !== null && block.page < MAX_PDF_PAGES,
  );
}

export function canvasPageCount(input: CanvasPagesInput): number {
  return canvasBlocks(input).reduce((count, block) => Math.max(count, block.page + 1), 0);
}

export function canvasPagesHtml(input: CanvasPagesInput): string {
  const blocks = canvasBlocks(input);
  const count = Math.max(input.pageCount, canvasPageCount(input));
  const pages = Array.from({ length: count }, (_, page) => {
    const inner = blocks
      .filter((block) => block.page === page)
      .map((block) => block.html)
      .join("");
    return `<div class="page">${inner}</div>`;
  });
  const style = `${input.fontCss}@page{size:A4;margin:0}html,body{margin:0;padding:0;background:transparent}.page{position:relative;width:${PAGE_WIDTH_MM}mm;height:${PAGE_HEIGHT_MM}mm;overflow:hidden;break-after:page}.page:last-child{break-after:auto}`;
  return `<!doctype html><html lang="hi"><head><meta charset="utf-8"><style>${style}</style></head><body>${pages.join("")}</body></html>`;
}
