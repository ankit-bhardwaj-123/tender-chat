import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { stackPages } from "@/server/adapters/pdf-printer";

async function blankPdf(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let index = 0; index < pages; index += 1) {
    doc.addPage([595.28, 841.89]).drawRectangle({ x: 10, y: 10, width: 5, height: 5 });
  }
  return doc.save();
}

function layersOn(doc: PDFDocument, index: number): number {
  return doc.getPage(index).node.normalizedEntries().XObject.keys().length;
}

describe("stackPages", () => {
  it("makes as many pages as the longer of the page and the canvas", async () => {
    const out = await stackPages(await blankPdf(1), await blankPdf(3), await blankPdf(1));
    const doc = await PDFDocument.load(out);
    expect(doc.getPageCount()).toBe(3);
    expect(layersOn(doc, 2)).toBe(1);
  });

  it("draws the letterhead under page 1 only", async () => {
    const out = await stackPages(await blankPdf(2), await blankPdf(2), await blankPdf(1));
    const doc = await PDFDocument.load(out);
    expect(layersOn(doc, 0)).toBe(3);
    expect(layersOn(doc, 1)).toBe(2);
  });
});
