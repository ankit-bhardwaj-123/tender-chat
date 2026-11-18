import { describe, expect, it } from "vitest";
import { toTemplate } from "@/shared/dto";
import { EditTemplateBody, NewTemplateBody } from "@/shared/template-body";

describe("new template body", () => {
  it("trims the name and squeezes inner spaces", () => {
    expect(NewTemplateBody.parse({ name: "  पैदल   मार्च ", language: "hi" })).toEqual({
      name: "पैदल मार्च",
      language: "hi",
    });
  });

  it("stores the name in NFC form", () => {
    expect(NewTemplateBody.parse({ name: "Café", language: "en" }).name).toBe("Café");
  });

  it("rejects a missing, empty or blank name", () => {
    for (const name of [undefined, "", "   "]) {
      expect(NewTemplateBody.safeParse({ name, language: "hi" }).success).toBe(false);
    }
  });

  it("accepts 200 characters and rejects 201", () => {
    expect(NewTemplateBody.safeParse({ name: "a".repeat(200), language: "en" }).success).toBe(true);
    expect(NewTemplateBody.safeParse({ name: "a".repeat(201), language: "en" }).success).toBe(
      false,
    );
  });

  it("accepts only hi and en as the language", () => {
    expect(NewTemplateBody.safeParse({ name: "x", language: "hi" }).success).toBe(true);
    expect(NewTemplateBody.safeParse({ name: "x", language: "en" }).success).toBe(true);
    for (const language of ["fr", "", "Hindi", undefined]) {
      expect(NewTemplateBody.safeParse({ name: "x", language }).success).toBe(false);
    }
  });
});

describe("edit template body", () => {
  it("allows changing only the name or only the language", () => {
    expect(EditTemplateBody.parse({ name: " New " })).toEqual({ name: "New" });
    expect(EditTemplateBody.parse({ language: "en" })).toEqual({ language: "en" });
    expect(EditTemplateBody.parse({})).toEqual({});
  });

  it("still refuses a blank name or an unknown language", () => {
    expect(EditTemplateBody.safeParse({ name: "  " }).success).toBe(false);
    expect(EditTemplateBody.safeParse({ language: "fr" }).success).toBe(false);
  });
});

describe("toTemplate", () => {
  it("maps a row to the API shape", () => {
    const createdAt = new Date("2026-11-18T10:00:00.000Z");
    expect(
      toTemplate({
        id: "t1",
        name: "Quote",
        language: "hi",
        fileName: "quote.html",
        sizeBytes: 2158,
        placeholders: ["officer", "date"],
        createdAt,
        updatedAt: createdAt,
      }),
    ).toEqual({
      id: "t1",
      name: "Quote",
      language: "hi",
      fileName: "quote.html",
      size: 2158,
      placeholders: ["officer", "date"],
      createdAt: "2026-11-18T10:00:00.000Z",
      updatedAt: "2026-11-18T10:00:00.000Z",
    });
  });
});
