import { describe, expect, it } from "vitest";
import { nextPdfName } from "@/shared/pdf-name";

describe("nextPdfName", () => {
  it("uses the company name first, then adds 2, 3 and so on", () => {
    expect(nextPdfName("Sharma Builders", [])).toBe("Sharma Builders");
    expect(nextPdfName("Sharma Builders", ["Sharma Builders"])).toBe("Sharma Builders 2");
    expect(nextPdfName("Sharma Builders", ["Sharma Builders", "Sharma Builders 2"])).toBe(
      "Sharma Builders 3",
    );
  });

  it("fills a free gap", () => {
    expect(nextPdfName("A", ["A", "A 3"])).toBe("A 2");
  });

  it("doesn't count another company's names", () => {
    expect(nextPdfName("Verma", ["Sharma", "Sharma 2"])).toBe("Verma");
  });

  it("works with Hindi names, whatever their Unicode form", () => {
    const name = "शर्मा निर्माण";
    expect(nextPdfName(name, [name.normalize("NFD")])).toBe(`${name} 2`);
  });
});
