import type { CanvasItem, TenderCanvas } from "@/types";
import { describe, expect, it } from "vitest";
import { type CanvasPagesInput, canvasPagesHtml, defaultCanvas } from "@/shared/canvas";
import { fontOf, fontStack } from "@/shared/fonts";
import { PdfBody } from "@/shared/pdf-body";

function text(y: number, value: string): CanvasItem {
  return { id: `t${y}`, kind: "text", x: 10, y, width: 70, height: 10, text: value, imageId: null };
}

function input(canvas: TenderCanvas): CanvasPagesInput {
  return {
    canvas,
    sealTop: null,
    sealUrl: null,
    imageUrls: {},
    fontCss: "",
    fontStack: fontStack(fontOf("mukta")),
    pageCount: 1,
  };
}

describe("canvas pages edges", () => {
  it("keeps the text box's line breaks, line height and colour when the font name has quotes", () => {
    const html = canvasPagesHtml(input({ ...defaultCanvas(), items: [text(20, "पंक्ति")] }));
    const block = /<div style="[^"]*"[^<]*पंक्ति/.exec(html)?.[0] ?? "";
    const style = /style="([^"]*)"/.exec(block)?.[1] ?? "";
    expect(style).toContain("white-space:pre-wrap");
    expect(style).toContain("line-height:1.3");
    expect(style).toContain("font-size:12pt");
    expect(style).toContain("color:#000");
  });

  it("escapes a script tag and a placeholder inside a text box", () => {
    const html = canvasPagesHtml(
      input({ ...defaultCanvas(), items: [text(20, "<script>x()</script>{{rate}} ✅")] }),
    );
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("{{rate}} ✅");
  });

  it("puts an item exactly on the page line at the top of page 2", () => {
    const html = canvasPagesHtml(input({ ...defaultCanvas(), items: [text(297, "दो")] }));
    const sheets = html.split('<div class="page">').slice(1);
    expect(sheets).toHaveLength(2);
    expect(sheets[1]).toContain("top:0mm");
    expect(sheets[0]).not.toContain("दो");
  });
});

describe("PdfBody", () => {
  it("accepts a measured seal top or null", () => {
    expect(PdfBody.safeParse({ sealTop: 120.5 }).success).toBe(true);
    expect(PdfBody.safeParse({ sealTop: null }).success).toBe(true);
  });

  it("rejects a missing, negative or text seal top", () => {
    expect(PdfBody.safeParse({}).success).toBe(false);
    expect(PdfBody.safeParse({ sealTop: -1 }).success).toBe(false);
    expect(PdfBody.safeParse({ sealTop: "120" }).success).toBe(false);
  });
});
