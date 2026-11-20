import { describe, expect, it } from "vitest";
import { fontFaceCss, fontOf } from "@/shared/fonts";
import { pageDocument, PREVIEW_CSS } from "@/shared/page-document";

const HTML = "<html><head></head><body><p>{{name}} {{rate}}</p></body></html>";
const url = (fileName: string) => `/fonts/${fileName}`;

describe("pageDocument", () => {
  it("gives the preview and the print the same page CSS and font rule", () => {
    const preview = pageDocument(HTML, { rate: "5" }, "mukta", url, "");
    const print = pageDocument(
      HTML,
      { rate: "5" },
      "mukta",
      url,
      "[data-empty]{visibility:hidden}",
    );
    expect(preview).toContain(PREVIEW_CSS);
    expect(print).toContain(PREVIEW_CSS);
    expect(print).toContain('font-family:"Mukta", system-ui, sans-serif !important');
    expect(print).toContain("[data-empty]{visibility:hidden}");
    expect(print.indexOf("data-preview")).toBeLessThan(print.indexOf("</head>"));
  });

  it("keeps an empty blank's box so the print layout matches the preview", () => {
    const print = pageDocument(HTML, {}, null, url, "");
    expect(print).toContain('<span data-field="name" data-empty="">name</span>');
  });

  it("includes only the chosen font's faces", () => {
    const css = fontFaceCss(url, fontOf("gotu"));
    expect(css.split("\n")).toHaveLength(2);
    expect(css).toContain("gotu-devanagari-400-normal.woff2");
    expect(css).not.toContain("poppins");
  });

  it("drops scripts from an edited page", () => {
    const print = pageDocument("<p>a</p><script>alert(1)</script>", {}, null, url, "");
    expect(print).not.toContain("<script");
  });

  it("drops a meta refresh from an edited page", () => {
    const print = pageDocument(
      '<html><head><meta http-equiv="refresh" content="0;url=http://x"><meta charset="utf-8"></head><body></body></html>',
      {},
      null,
      url,
      "",
    );
    expect(print).not.toContain("refresh");
    expect(print).toContain('<meta charset="utf-8">');
  });
});
