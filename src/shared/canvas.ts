import { z } from "zod";
import type { CanvasItem, TenderCanvas } from "@/types";

export const PAGE_WIDTH_MM = 210;
export const PAGE_HEIGHT_MM = 297;
export const MIN_ITEM_MM = 5;
export const SEAL_WIDTH_MM = 35;
export const TEXT_BOX_WIDTH_MM = 70;
export const TEXT_BOX_HEIGHT_MM = 10;
export const IMAGE_WIDTH_MM = 45;
export const IMAGE_HEIGHT_MM = 30;
export const TEXT_BOX_FONT_PT = 12;

const size = z.number().min(0).max(100000);

export const CanvasBody = z.object({
  items: z.array(
    z.object({
      id: z.string().min(1).max(64),
      kind: z.enum(["text", "image"]),
      x: size,
      y: size,
      width: size,
      height: size,
      text: z.string(),
      imageId: z.uuid().nullable(),
    }),
  ),
  seal: z.object({
    shown: z.boolean(),
    x: size.nullable(),
    y: size.nullable(),
    width: size,
  }),
});

export function defaultCanvas(): TenderCanvas {
  return { items: [], seal: { shown: true, x: null, y: null, width: SEAL_WIDTH_MM } };
}

export function readCanvas(raw: unknown): TenderCanvas {
  const parsed = CanvasBody.safeParse(raw);
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
