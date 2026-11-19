import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { companySummary } from "@/components/companies/company-list";
import { FontFaces } from "@/components/shell/font-faces";
import { FONTS } from "@/shared/fonts";
import type { Company } from "@/types";

const FILE = { fileName: "f", size: 1, uploadedAt: "2026-01-01T00:00:00.000Z" };

function companyWith(fontKey: string | null, withFiles: boolean): Company {
  return {
    id: "c1",
    name: "Balaji",
    fontKey,
    files: { letterhead: withFiles ? FILE : null, seal: withFiles ? FILE : null },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("font faces", () => {
  const html = renderToStaticMarkup(createElement(FontFaces));

  it("renders a single style tag when the app layout draws it", () => {
    expect(html.startsWith("<style>")).toBe(true);
    expect(html.match(/<style/g)).toHaveLength(1);
  });

  it("keeps the CSS quotes intact when rendered on the server", () => {
    expect(html).not.toContain("&quot;");
    expect(html).toContain('font-family:"Mukta"');
  });

  it("loads every font from our own /fonts path when rendered", () => {
    const urls = [...html.matchAll(/url\("([^"]+)"\)/g)].map((match) => match[1]);
    expect(urls).toHaveLength(34);
    for (const url of urls) {
      expect(url).toMatch(/^\/fonts\/[a-z0-9-]+\.woff2$/);
    }
    expect(html).not.toMatch(/https?:|googleapis|gstatic/);
  });

  it("declares a face for every font family in the list", () => {
    for (const font of FONTS) {
      expect(html).toContain(`font-family:"${font.family}"`);
    }
  });
});

describe("company summary", () => {
  it("shows the font name after the files when a font is set", () => {
    expect(companySummary(companyWith("mukta", true))).toBe("Letterhead · Seal · Mukta");
  });

  it("shows Poppins (default) when no font is set", () => {
    expect(companySummary(companyWith(null, false))).toBe("No files yet · Poppins (default)");
  });
});
