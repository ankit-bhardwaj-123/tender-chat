import { describe, expect, it } from "vitest";
import { toTender } from "@/shared/dto";
import { CreateTenderBody, UpdateTenderBody } from "@/shared/tender-body";

const ID = "3f1c2b8e-4d5a-4c6b-9e7f-1a2b3c4d5e6f";

describe("tender bodies", () => {
  it("accepts a create body when the name is missing", () => {
    expect(CreateTenderBody.safeParse({}).success).toBe(true);
  });

  it("accepts a create body when a name is given", () => {
    expect(CreateTenderBody.parse({ name: "Road" })).toEqual({ name: "Road" });
  });

  it("rejects a create body when the name isn't a string or the body isn't an object", () => {
    expect(CreateTenderBody.safeParse({ name: 5 }).success).toBe(false);
    expect(CreateTenderBody.safeParse(null).success).toBe(false);
  });

  it("accepts an update body with any subset of its fields", () => {
    expect(UpdateTenderBody.parse({})).toEqual({});
    expect(UpdateTenderBody.parse({ name: "Road" })).toEqual({ name: "Road" });
    expect(UpdateTenderBody.parse({ companyId: ID, templateId: null })).toEqual({
      companyId: ID,
      templateId: null,
    });
    expect(UpdateTenderBody.parse({ values: { "अधिकारी का नाम": "श्री राम" } })).toEqual({
      values: { "अधिकारी का नाम": "श्री राम" },
    });
  });

  it("rejects an update body with a bad name, id or values", () => {
    expect(UpdateTenderBody.safeParse({ name: null }).success).toBe(false);
    expect(UpdateTenderBody.safeParse([]).success).toBe(false);
    expect(UpdateTenderBody.safeParse({ companyId: "not-a-uuid" }).success).toBe(false);
    expect(UpdateTenderBody.safeParse({ templateId: 5 }).success).toBe(false);
    expect(UpdateTenderBody.safeParse({ values: { a: 5 } }).success).toBe(false);
    expect(UpdateTenderBody.safeParse({ values: ["a"] }).success).toBe(false);
  });

  it("drops unknown fields such as userId when it parses a body", () => {
    const parsed = UpdateTenderBody.parse({ name: "Road", userId: "someone-else", id: "x" });
    expect(parsed).toEqual({ name: "Road" });
  });
});

describe("toTender", () => {
  it("returns the editor fields and ISO dates, but not the owner, when it maps a row", () => {
    const row = {
      id: "t1",
      userId: "u1",
      name: "Road",
      type: "quotation" as const,
      companyId: null,
      templateId: null,
      values: null,
      createdAt: new Date("2026-11-18T10:00:00.000Z"),
      updatedAt: new Date("2026-11-18T11:00:00.000Z"),
    };
    expect(toTender(row)).toEqual({
      id: "t1",
      name: "Road",
      type: "quotation",
      companyId: null,
      templateId: null,
      values: {},
      createdAt: "2026-11-18T10:00:00.000Z",
      updatedAt: "2026-11-18T11:00:00.000Z",
    });
  });
});
