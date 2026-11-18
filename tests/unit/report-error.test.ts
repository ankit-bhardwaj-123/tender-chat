import { describe, expect, it, vi } from "vitest";
import { createErrorReport, createErrorReporter, type ErrorReport } from "@/server/report-error";

describe("report-error", () => {
  it("keeps only id-like context keys when it builds a report", () => {
    const report = createErrorReport(new Error("boom"), {
      route: "/api/tenders",
      tenderId: "t1",
      cookie: "secret",
      name: "Road",
      attempt: 2,
      userId: undefined,
    });
    expect(report.context).toEqual({ route: "/api/tenders", tenderId: "t1", attempt: 2 });
  });

  it("cuts the message to 500 characters when it is very long", () => {
    const report = createErrorReport(new Error("x".repeat(2000)));
    expect(report.message).toHaveLength(500);
  });

  it("turns a thrown string into an Error report when the value isn't an Error", () => {
    const report = createErrorReport("plain");
    expect(report).toMatchObject({ name: "Error", message: "plain" });
  });

  it("doesn't throw when the transport fails", () => {
    const send = vi.fn((_report: ErrorReport) => {
      throw new Error("transport down");
    });
    const reporter = createErrorReporter({ send });
    expect(() => reporter.capture(new Error("boom"))).not.toThrow();
    expect(send).toHaveBeenCalledOnce();
  });
});
