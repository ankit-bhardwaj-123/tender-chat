import type { Tender, TenderCanvas } from "@/types";
import { describe, expect, it } from "vitest";
import { rebaseDraft, type TenderDraft } from "@/lib/editor";
import { defaultCanvas } from "@/shared/canvas";

function tender(
  values: Record<string, string>,
  customHtml: string | null,
  canvas: TenderCanvas,
): Tender {
  return {
    id: "t",
    name: "Road",
    type: "quotation",
    companyId: null,
    templateId: null,
    values,
    customHtml,
    canvas,
    createdAt: "2026-11-20T10:00:00.000Z",
    updatedAt: "2026-11-20T10:00:00.000Z",
  };
}

const moved: TenderCanvas = { items: [], seal: { shown: true, x: 100, y: 120, width: 35 } };

describe("rebaseDraft", () => {
  it("takes the server's newer copy of every part the user didn't touch", () => {
    const base = tender({ a: "1" }, null, defaultCanvas());
    const server = tender({ a: "2" }, "<p>other tab</p>", moved);
    const draft: TenderDraft = { values: { a: "1" }, customHtml: null, canvas: defaultCanvas() };
    expect(rebaseDraft(draft, base, server)).toEqual({
      values: { a: "2" },
      customHtml: "<p>other tab</p>",
      canvas: moved,
    });
  });

  it("keeps the parts the user changed and hasn't saved yet", () => {
    const base = tender({ a: "1" }, null, defaultCanvas());
    const server = tender({ a: "2" }, "<p>other tab</p>", moved);
    const draft: TenderDraft = {
      values: { a: "mine" },
      customHtml: "<p>mine</p>",
      canvas: defaultCanvas(),
    };
    expect(rebaseDraft(draft, base, server)).toEqual({
      values: { a: "mine" },
      customHtml: "<p>mine</p>",
      canvas: moved,
    });
  });

  it("treats a value in another Unicode form as untouched", () => {
    const base = tender({ a: "क़मीन".normalize("NFD") }, null, defaultCanvas());
    const server = tender({ a: "new" }, null, defaultCanvas());
    const draft: TenderDraft = {
      values: { a: "क़मीन".normalize("NFC") },
      customHtml: null,
      canvas: defaultCanvas(),
    };
    expect(rebaseDraft(draft, base, server).values).toEqual({ a: "new" });
  });
});
