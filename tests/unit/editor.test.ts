import { describe, expect, it } from "vitest";
import { fitWidthScale, keptValues, nextZoom, sameValues } from "@/lib/editor";

describe("editor helpers", () => {
  it("keeps only the values whose names the new template has", () => {
    expect(keptValues({ a: "1", b: "2", c: "" }, ["a", "c", "d"])).toEqual({ a: "1", c: "" });
    expect(keptValues({ a: "1" }, [])).toEqual({});
  });

  it("treats a missing value and an empty one as the same", () => {
    expect(sameValues({ a: "" }, {})).toBe(true);
    expect(sameValues({ a: "1" }, { a: "1" })).toBe(true);
    expect(sameValues({ a: "1" }, { a: "2" })).toBe(false);
    expect(sameValues({}, { b: "x" })).toBe(false);
  });

  it("steps zoom in and out and stops at 50 % and 200 %", () => {
    expect(nextZoom(100, 80, "in")).toBe(125);
    expect(nextZoom(100, 80, "out")).toBe(75);
    expect(nextZoom("fit", 80, "in")).toBe(100);
    expect(nextZoom(50, 80, "out")).toBe(50);
    expect(nextZoom(200, 80, "in")).toBe(200);
  });

  it("goes 50, 60, 70, 75, 100 when zooming in from the smallest size", () => {
    expect(nextZoom(50, 80, "in")).toBe(60);
    expect(nextZoom(60, 80, "in")).toBe(70);
    expect(nextZoom(70, 80, "in")).toBe(75);
    expect(nextZoom(75, 80, "in")).toBe(100);
    expect(nextZoom(75, 80, "out")).toBe(70);
  });

  it("fits the page width inside the box after 16 px padding each side", () => {
    expect(fitWidthScale(794 + 32)).toBe(1);
    expect(fitWidthScale(0)).toBe(1);
    expect(fitWidthScale(40)).toBe(0.1);
  });
});
