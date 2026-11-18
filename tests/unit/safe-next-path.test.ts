import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/auth";

describe("safeNextPath", () => {
  it("keeps a path inside the app", () => {
    expect(safeNextPath("/t/abc?x=1#top")).toBe("/t/abc?x=1#top");
  });

  it("falls back to / for outside or odd links", () => {
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath("https://evil.example")).toBe("/");
    expect(safeNextPath("//evil.example")).toBe("/");
    expect(safeNextPath("/login")).toBe("/");
  });

  it("falls back to / when the path is empty or relative", () => {
    expect(safeNextPath("")).toBe("/");
    expect(safeNextPath("t/abc")).toBe("/");
    expect(safeNextPath("javascript:alert(1)")).toBe("/");
  });

  it("falls back to / when a backslash or tab turns the path into another host", () => {
    expect(safeNextPath("/\\evil.example")).toBe("/");
    expect(safeNextPath("/\\/evil.example")).toBe("/");
    expect(safeNextPath("/\t/evil.example")).toBe("/");
    expect(safeNextPath("/\n/evil.example")).toBe("/");
  });

  it("falls back to / when the login page is reached with a query, hash or dot segments", () => {
    expect(safeNextPath("/login?next=%2F%2Fevil.example")).toBe("/");
    expect(safeNextPath("/login#x")).toBe("/");
    expect(safeNextPath("/./login")).toBe("/");
    expect(safeNextPath("/t/../login")).toBe("/");
  });

  it("never returns a protocol-relative path when the path hides slashes in percent codes", () => {
    const result = safeNextPath("/%2F%2Fevil.example");
    expect(result.startsWith("/")).toBe(true);
    expect(result.startsWith("//")).toBe(false);
  });

  it("keeps Hindi text in the query when the path is inside the app", () => {
    expect(safeNextPath("/t/abc?q=पुल")).toBe("/t/abc?q=%E0%A4%AA%E0%A5%81%E0%A4%B2");
  });
});
