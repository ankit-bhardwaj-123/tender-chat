import type { Tender, TenderCanvas } from "@/types";
import { afterEach, describe, expect, it, vi } from "vitest";
import { draftChanges, imageProblem, previewDocument, sameValues } from "@/lib/editor";
import { withBody } from "@/lib/page-editing";
import { checkUploadPath } from "@/services/upload.service";
import { CanvasBody, defaultCanvas, keepOnSheet, newImage, readCanvas } from "@/shared/canvas";
import { findPlaceholders } from "@/shared/placeholders";

const USER = "11111111-2222-4333-8444-555555555555";
const FILE_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const IMAGE_ID = "3f1c2b8e-4d5a-4c6b-9e7f-1a2b3c4d5e6f";
const MB = 1024 * 1024;

afterEach(() => {
  vi.unstubAllGlobals();
});

function savedTender(values: Record<string, string>, canvas: TenderCanvas): Tender {
  return {
    id: "t",
    name: "Road",
    type: "quotation",
    companyId: null,
    templateId: null,
    values,
    customHtml: null,
    canvas,
    createdAt: "2026-11-20T00:00:00.000Z",
    updatedAt: "2026-11-20T00:00:00.000Z",
  };
}

function canvasWithText(): TenderCanvas {
  return {
    items: [
      { id: "a", kind: "text", x: 10, y: 320, width: 70, height: 10, text: "x", imageId: null },
    ],
    seal: { shown: true, x: 140, y: 200, width: 35 },
  };
}

function fileOf(name: string, size: number): File {
  return new File([new Uint8Array(size)], name);
}

describe("autosave changes", () => {
  it("sends nothing when the draft matches the saved tender", () => {
    const canvas = canvasWithText();
    const saved = savedTender({ a: "1" }, canvas);
    expect(draftChanges({ values: { a: "1" }, customHtml: null, canvas }, saved)).toEqual({});
  });

  it("sends only the parts that changed", () => {
    const saved = savedTender({ a: "1" }, defaultCanvas());
    expect(
      draftChanges({ values: { a: "1" }, customHtml: "<p>x</p>", canvas: defaultCanvas() }, saved),
    ).toEqual({ customHtml: "<p>x</p>" });
    const moved = { ...defaultCanvas(), seal: { shown: true, x: 10, y: 10, width: 35 } };
    expect(draftChanges({ values: { a: "2" }, customHtml: null, canvas: moved }, saved)).toEqual({
      values: { a: "2" },
      canvas: moved,
    });
  });

  it("sees no canvas change when the database hands the keys back in another order", () => {
    const draft = canvasWithText();
    const shuffled = {
      seal: { width: 35, y: 200, x: 140, shown: true },
      items: [
        { imageId: null, text: "x", height: 10, width: 70, y: 320, x: 10, kind: "text", id: "a" },
      ],
    };
    const saved = savedTender({}, readCanvas(shuffled));
    expect(draftChanges({ values: {}, customHtml: null, canvas: draft }, saved)).toEqual({});
  });

  it("sees no value change when the server stored the same Hindi text in NFC form", () => {
    expect(sameValues({ a: "क़मीन" }, { a: "क़मीन" })).toBe(true);
  });
});

describe("image pre-check", () => {
  it("accepts a JPG or PNG up to exactly 5 MB, in any letter case", () => {
    expect(imageProblem(fileOf("photo.JPG", 10))).toBeNull();
    expect(imageProblem(fileOf("logo.png", 5 * MB))).toBeNull();
    expect(imageProblem(fileOf("a.jpeg", 1))).toBeNull();
  });

  it("names the reason when the type, emptiness or size is wrong", () => {
    expect(imageProblem(fileOf("scan.pdf", 10))).toBe("it must be a JPG or PNG");
    expect(imageProblem(fileOf("noextension", 10))).toBe("it must be a JPG or PNG");
    expect(imageProblem(fileOf("a.png", 0))).toBe("the file is empty");
    expect(imageProblem(fileOf("a.png", 5 * MB + 1))).toBe("it must be at most 5 MB");
  });

  it("allows a direct Blob upload of a png image with the 5 MB limit and image types only", () => {
    expect(checkUploadPath(USER, "tenderImage", `uploads/${USER}/${FILE_ID}.png`)).toEqual({
      maximumSizeInBytes: 5 * MB,
      allowedContentTypes: ["image/jpeg", "image/png"],
    });
    expect(() => checkUploadPath(USER, "tenderImage", `uploads/${USER}/${FILE_ID}.pdf`)).toThrow();
  });
});

describe("edited page", () => {
  it("never lets a script or event handler in the edited page reach the preview", () => {
    vi.stubGlobal("window", { location: { origin: "https://app.test" } });
    const html = previewDocument(
      '<html><head></head><body><p onclick="alert(1)">{{a}}</p><img src=x onerror=alert(2)><SCRIPT>alert(3)</SCRIPT></body></html>',
      { a: "<script>alert(4)</script>{{b}}" },
      null,
    );
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/onclick|onerror/i);
    expect(html).toContain("&lt;script&gt;alert(4)&lt;/script&gt;{{b}}");
  });

  it("lists each blank once and drops a blank that was deleted from the page", () => {
    expect(findPlaceholders("<p>{{नाम}} and {{नाम}} and {{rate}}</p>")).toEqual(["नाम", "rate"]);
    expect(findPlaceholders("<p>{{नाम}} and </p>")).toEqual(["नाम"]);
  });

  it("keeps the template's head and body tag when the template has no </body>", () => {
    const source =
      '<html><head><meta charset="utf-8"><style>p{margin:0}</style></head><body style="padding:20mm"><p>old</p>';
    const result = withBody(source, "<p>new</p>");
    expect(result).toContain('<meta charset="utf-8">');
    expect(result).toContain('<body style="padding:20mm">');
    expect(result).toContain("<p>new</p>");
    expect(result).not.toContain("old");
  });
});

describe("canvas edges", () => {
  it("pulls an item dragged off the left or top edge back onto the sheet", () => {
    const item = newImage("i", IMAGE_ID, 0, 0);
    expect(keepOnSheet({ ...item, x: -30, y: -12 })).toMatchObject({ x: 0, y: 0 });
    expect(keepOnSheet({ ...item, x: 400 })).toMatchObject({ x: 210 - item.width });
  });

  it("keeps an image placed on page 2", () => {
    expect(newImage("i", IMAGE_ID, 20, 297 + 40).y).toBe(337);
  });

  it("keeps Hindi, emoji and markup typed into a text box as plain text", () => {
    const text = "नमस्ते 🙂 <script>alert(1)</script> {{x}}";
    const canvas = {
      ...defaultCanvas(),
      items: [{ ...newImage("i", IMAGE_ID, 0, 0), kind: "text" as const, imageId: null, text }],
    };
    expect(CanvasBody.parse(canvas).items[0]?.text).toBe(text);
  });

  it("refuses a canvas without a seal width or with a negative seal spot", () => {
    expect(
      CanvasBody.safeParse({ items: [], seal: { shown: true, x: null, y: null } }).success,
    ).toBe(false);
    expect(
      CanvasBody.safeParse({ items: [], seal: { shown: true, x: -1, y: 0, width: 35 } }).success,
    ).toBe(false);
  });
});
