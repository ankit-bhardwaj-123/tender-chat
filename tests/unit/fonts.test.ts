import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_FONT_KEY,
  FONT_SUBSETS,
  FONTS,
  fontFaceCss,
  fontOf,
  fontStack,
  isFontKey,
} from "@/shared/fonts";

describe("fonts", () => {
  it("lists the 10 fonts in the owner's order with Poppins first", () => {
    expect(FONTS.map((font) => font.label)).toEqual([
      "Poppins",
      "Noto Serif Devanagari",
      "Mukta",
      "Khand",
      "Eczar",
      "Tiro Devanagari Hindi",
      "Yatra One",
      "Anek Devanagari",
      "Laila",
      "Gotu",
    ]);
    expect(DEFAULT_FONT_KEY).toBe("poppins");
  });

  it("falls back to Poppins for no key or an unknown key", () => {
    expect(fontOf(null).key).toBe("poppins");
    expect(fontOf(undefined).key).toBe("poppins");
    expect(fontOf("gone").key).toBe("poppins");
    expect(fontOf("mukta").key).toBe("mukta");
  });

  it("knows only the listed keys", () => {
    expect(isFontKey("laila")).toBe(true);
    expect(isFontKey("Laila")).toBe(false);
    expect(isFontKey("")).toBe(false);
    expect(isFontKey(null)).toBe(false);
  });

  it("ships only regular for Yatra One, Gotu and Tiro Devanagari Hindi", () => {
    for (const key of ["yatra-one", "gotu", "tiro-devanagari-hindi"]) {
      expect(fontOf(key).weights).toEqual([400]);
    }
  });

  it("puts the font first in its stack with a system fallback", () => {
    expect(fontStack(fontOf("mukta"))).toBe('"Mukta", system-ui, sans-serif');
  });

  it("writes one swap rule per font, weight and subset, each naming a file in public/fonts", () => {
    const css = fontFaceCss((fileName) => `/fonts/${fileName}`);
    const rules = css.split("\n");
    const expected =
      FONTS.reduce((sum, font) => sum + font.weights.length, 0) * FONT_SUBSETS.length;
    expect(rules).toHaveLength(expected);
    expect(expected).toBe(34);
    for (const rule of rules) {
      expect(rule).toContain("font-display:swap");
      expect(rule).toContain("unicode-range:");
      const file = /url\("\/fonts\/([^"]+)"\)/.exec(rule)?.[1];
      expect(file).toBeDefined();
      expect(existsSync(path.join("public", "fonts", file ?? ""))).toBe(true);
    }
  });
});
