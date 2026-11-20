import { afterEach, describe, expect, it, vi } from "vitest";
import {
  A4_HEIGHT_PX,
  A4_WIDTH_PX,
  fitWidthScale,
  keptValues,
  nextZoom,
  previewDocument,
  sameValues,
  splitStorage,
  ZOOM_STEPS,
} from "@/lib/editor";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("editor helper edges", () => {
  it("uses A4 at 96 dpi for the sheet size", () => {
    expect(A4_WIDTH_PX).toBe(794);
    expect(A4_HEIGHT_PX).toBe(1123);
  });

  it("lists zoom steps in rising order from 50 to 200", () => {
    expect([...ZOOM_STEPS].sort((a, b) => a - b)).toEqual(ZOOM_STEPS);
    expect(ZOOM_STEPS[0]).toBe(50);
    expect(ZOOM_STEPS[ZOOM_STEPS.length - 1]).toBe(200);
  });

  it("steps from a fit size that sits between two steps", () => {
    expect(nextZoom("fit", 87, "in")).toBe(100);
    expect(nextZoom("fit", 87, "out")).toBe(75);
    expect(nextZoom("fit", 100.3, "in")).toBe(125);
    expect(nextZoom("fit", 100.3, "out")).toBe(75);
  });

  it("scales the page up when the box is wider than the page", () => {
    expect(fitWidthScale(2 * 794 + 32)).toBe(2);
    expect(fitWidthScale(-5)).toBe(1);
  });

  it("keeps Hindi keys and empty strings when the template changes", () => {
    expect(keptValues({ "अधिकारी का नाम": "श्री राम", old: "x" }, ["अधिकारी का नाम"])).toEqual({
      "अधिकारी का नाम": "श्री राम",
    });
  });

  it("sees a change in whitespace as a real change", () => {
    expect(sameValues({ a: "x" }, { a: "x " })).toBe(false);
  });

  it("falls back to a do-nothing store when there is no browser", () => {
    const storage = splitStorage();
    expect(storage.getItem("k")).toBeNull();
    expect(() => storage.setItem("k", "v")).not.toThrow();
  });

  it("falls back to a do-nothing store when localStorage throws", () => {
    const blocked = {};
    Object.defineProperty(blocked, "localStorage", {
      get() {
        throw new Error("denied");
      },
    });
    vi.stubGlobal("window", blocked);
    const storage = splitStorage();
    expect(storage.getItem("k")).toBeNull();
  });

  it("builds a preview with the font override after the template styles and the preview CSS before </head>", () => {
    vi.stubGlobal("window", { location: { origin: "https://app.test" } });
    const html = previewDocument(
      "<html><head><style>p{font-family:Arial}</style></head><body><p>{{a}}</p></body></html>",
      { a: "1" },
      "mukta",
    );
    const font = html.indexOf('<style data-font="">');
    const preview = html.indexOf('<style data-preview="">');
    expect(font).toBeGreaterThan(-1);
    expect(font).toBeGreaterThan(html.indexOf("Arial"));
    expect(preview).toBeLessThan(html.indexOf("</head>"));
    expect(html).toContain("https://app.test/fonts/");
    expect(html).not.toMatch(/https?:\/\/(?!app\.test)/);
    expect(html).toContain('<span data-field="a">1</span>');
  });

  it("uses the first font when the font key is unknown", () => {
    vi.stubGlobal("window", { location: { origin: "https://app.test" } });
    const known = previewDocument("<p>x</p>", {}, null);
    const unknown = previewDocument("<p>x</p>", {}, "../../etc");
    expect(unknown).toBe(known);
  });
});
