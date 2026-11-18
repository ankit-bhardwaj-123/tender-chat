import { describe, expect, it } from "vitest";
import { toTender } from "@/shared/dto";
import { CreateTenderBody, RenameTenderBody } from "@/shared/tender-body";

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

  it("rejects a rename body when the name is missing or not a string", () => {
    expect(RenameTenderBody.safeParse({}).success).toBe(false);
    expect(RenameTenderBody.safeParse({ name: null }).success).toBe(false);
    expect(RenameTenderBody.safeParse([]).success).toBe(false);
  });

  it("drops unknown fields such as userId when it parses a body", () => {
    const parsed = RenameTenderBody.parse({ name: "Road", userId: "someone-else", id: "x" });
    expect(parsed).toEqual({ name: "Road" });
  });
});

describe("toTender", () => {
  it("returns only id, name and ISO dates when it maps a row", () => {
    const row = {
      id: "t1",
      userId: "u1",
      name: "Road",
      createdAt: new Date("2026-11-18T10:00:00.000Z"),
      updatedAt: new Date("2026-11-18T11:00:00.000Z"),
    };
    expect(toTender(row)).toEqual({
      id: "t1",
      name: "Road",
      createdAt: "2026-11-18T10:00:00.000Z",
      updatedAt: "2026-11-18T11:00:00.000Z",
    });
  });
});
