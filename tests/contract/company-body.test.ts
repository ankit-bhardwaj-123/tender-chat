import { describe, expect, it } from "vitest";
import { CompanyBody } from "@/shared/company-body";
import { toCompany } from "@/shared/dto";

describe("company body", () => {
  it("trims the name and squeezes inner spaces", () => {
    expect(CompanyBody.parse({ name: "  Shree   Balaji  " })).toEqual({ name: "Shree Balaji" });
  });

  it("rejects a missing, empty or blank name", () => {
    expect(CompanyBody.safeParse({}).success).toBe(false);
    expect(CompanyBody.safeParse({ name: "" }).success).toBe(false);
    expect(CompanyBody.safeParse({ name: "   " }).success).toBe(false);
  });

  it("accepts 200 characters and rejects 201", () => {
    expect(CompanyBody.safeParse({ name: "a".repeat(200) }).success).toBe(true);
    expect(CompanyBody.safeParse({ name: "a".repeat(201) }).success).toBe(false);
  });

  it("normalises a name to NFC when it arrives decomposed", () => {
    expect(CompanyBody.parse({ name: "Café" }).name).toBe("Café");
  });

  it("keeps Hindi, emoji and markup text as typed when the name has them", () => {
    for (const name of [
      "श्री बालाजी कंस्ट्रक्शन",
      "Balaji 🏗️",
      "<script>alert(1)</script>",
      "{{x}}",
    ]) {
      expect(CompanyBody.parse({ name }).name).toBe(name);
    }
  });

  it("rejects a name made only of tabs and newlines", () => {
    expect(CompanyBody.safeParse({ name: "\t\n \r\n" }).success).toBe(false);
  });

  it("rejects a name that isn't a string", () => {
    expect(CompanyBody.safeParse({ name: 5 }).success).toBe(false);
  });

  it("accepts a missing, null or known font", () => {
    expect(CompanyBody.parse({ name: "A" }).fontKey).toBeUndefined();
    expect(CompanyBody.parse({ name: "A", fontKey: null }).fontKey).toBeNull();
    expect(CompanyBody.parse({ name: "A", fontKey: "mukta" }).fontKey).toBe("mukta");
  });

  it("rejects an unknown, empty or non-string font", () => {
    for (const fontKey of ["comic-sans", "", 5, "Mukta"]) {
      expect(CompanyBody.safeParse({ name: "A", fontKey }).success).toBe(false);
    }
  });
});

describe("toCompany", () => {
  const row = {
    id: "c1",
    name: "Balaji",
    fontKey: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-02T00:00:00Z"),
  };

  it("puts each file under its kind and ignores other companies' files", () => {
    const company = toCompany(row, [
      {
        companyId: "c1",
        kind: "seal",
        fileName: "seal.jpg",
        sizeBytes: 12,
        createdAt: new Date("2026-01-03T00:00:00Z"),
      },
      {
        companyId: "c2",
        kind: "letterhead",
        fileName: "other.pdf",
        sizeBytes: 5,
        createdAt: new Date("2026-01-03T00:00:00Z"),
      },
    ]);
    expect(company.files).toEqual({
      letterhead: null,
      seal: { fileName: "seal.jpg", size: 12, uploadedAt: "2026-01-03T00:00:00.000Z" },
    });
  });

  it("passes a known font through and turns an unknown one into null", () => {
    expect(toCompany({ ...row, fontKey: "laila" }, []).fontKey).toBe("laila");
    expect(toCompany({ ...row, fontKey: "gone-font" }, []).fontKey).toBeNull();
  });
});
