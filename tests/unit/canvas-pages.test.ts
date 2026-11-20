import type { CanvasItem, TenderCanvas } from "@/types";
import { describe, expect, it } from "vitest";
import {
  CanvasBody,
  type CanvasPagesInput,
  canvasPageCount,
  canvasPagesHtml,
  defaultCanvas,
  MAX_TOP_MM,
  readCanvas,
  sealLeft,
  sealTopOf,
} from "@/shared/canvas";
import { PdfBody } from "@/shared/pdf-body";

const IMAGE_ID = "3f1c2b8e-4d5a-4c6b-9e7f-1a2b3c4d5e6f";

function text(y: number, value = "नमस्ते"): CanvasItem {
  return { id: `t${y}`, kind: "text", x: 10, y, width: 70, height: 10, text: value, imageId: null };
}

function input(canvas: TenderCanvas, extra: Partial<CanvasPagesInput> = {}): CanvasPagesInput {
  return {
    canvas,
    sealTop: null,
    sealUrl: null,
    imageUrls: {},
    fontCss: "",
    fontStack: '"Mukta", sans-serif',
    pageCount: 1,
    ...extra,
  };
}

function pages(html: string): string[] {
  return html.split('<div class="page">').slice(1);
}

describe("canvas pages", () => {
  it("puts an item at 310 mm on page 2 at 13 mm", () => {
    const html = canvasPagesHtml(input({ ...defaultCanvas(), items: [text(310)] }));
    const [first, second] = pages(html);
    expect(pages(html)).toHaveLength(2);
    expect(first).not.toContain("नमस्ते");
    expect(second).toContain("top:13mm");
    expect(second).toContain("नमस्ते");
  });

  it("makes at least as many sheets as the printed page", () => {
    expect(pages(canvasPagesHtml(input(defaultCanvas(), { pageCount: 3 })))).toHaveLength(3);
  });

  it("escapes text box text", () => {
    const html = canvasPagesHtml(input({ ...defaultCanvas(), items: [text(5, "<b>x</b>")] }));
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt;");
  });

  it("places an unmoved seal 25 mm from the right edge at the measured top", () => {
    const seal = defaultCanvas().seal;
    expect(sealLeft(seal)).toBe(210 - 25 - 35);
    expect(sealTopOf(seal, 120)).toBe(120);
    expect(sealTopOf({ ...seal, y: 40 }, 120)).toBe(40);
    const html = canvasPagesHtml(
      input(defaultCanvas(), { sealTop: 120, sealUrl: "data:image/jpeg;base64,AA" }),
    );
    expect(html).toContain("top:120mm;left:150mm;width:35mm;");
  });

  it("leaves out a hidden seal and a seal without a file", () => {
    const hidden = { ...defaultCanvas(), seal: { ...defaultCanvas().seal, shown: false } };
    expect(canvasPagesHtml(input(hidden, { sealUrl: "data:x" }))).not.toContain("<img");
    expect(canvasPagesHtml(input(defaultCanvas()))).not.toContain("<img");
  });

  it("skips an image whose file is missing and keeps one that loaded", () => {
    const image: CanvasItem = { ...text(400), kind: "image", text: "", imageId: IMAGE_ID };
    const canvas = { ...defaultCanvas(), items: [image] };
    expect(canvasPageCount(input(canvas))).toBe(0);
    const html = canvasPagesHtml(
      input(canvas, { imageUrls: { [IMAGE_ID]: "data:image/png;base64,AA" } }),
    );
    expect(pages(html)).toHaveLength(2);
    expect(html).toContain('src="data:image/png;base64,AA"');
  });
});

describe("PDF limits", () => {
  it("leaves out canvas blocks past page 20", () => {
    const html = canvasPagesHtml(input({ ...defaultCanvas(), items: [text(297 * 25)] }));
    expect(pages(html)).toHaveLength(1);
    expect(html).not.toContain("नमस्ते");
  });

  it("saves at most 200 canvas items but still reads a bigger stored canvas", () => {
    const items = Array.from({ length: 201 }, (_, index) => ({ ...text(5), id: `t${index}` }));
    expect(CanvasBody.safeParse({ ...defaultCanvas(), items }).success).toBe(false);
    expect(readCanvas({ ...defaultCanvas(), items }).items).toHaveLength(201);
  });

  it("refuses a seal top past page 20", () => {
    expect(PdfBody.safeParse({ sealTop: MAX_TOP_MM + 1 }).success).toBe(false);
    expect(PdfBody.safeParse({ sealTop: MAX_TOP_MM }).success).toBe(true);
  });
});
