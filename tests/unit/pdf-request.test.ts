import { afterEach, describe, expect, it, vi } from "vitest";
import { PDF_FAILED, requestTenderPdf } from "@/lib/editor";

afterEach(() => {
  vi.unstubAllGlobals();
});

function answer(response: Response | Error) {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => (response instanceof Error ? Promise.reject(response) : Promise.resolve(response))),
  );
}

describe("requestTenderPdf", () => {
  it("returns the PDF and its file name", async () => {
    answer(
      new Response(new Uint8Array([1, 2]), {
        headers: { "Content-Disposition": "attachment; filename*=UTF-8''Road%20repair.pdf" },
      }),
    );
    const pdf = await requestTenderPdf("t1", 120);
    expect(pdf.fileName).toBe("Road repair.pdf");
    expect(pdf.blob.size).toBe(2);
  });

  it("says the PDF can't be made on a network error or any server error", async () => {
    answer(new TypeError("Failed to fetch"));
    await expect(requestTenderPdf("t1", null)).rejects.toThrow(PDF_FAILED);
    answer(new Response("gateway", { status: 504 }));
    await expect(requestTenderPdf("t1", null)).rejects.toThrow(PDF_FAILED);
    answer(Response.json({ error: { message: "Something went wrong." } }, { status: 500 }));
    await expect(requestTenderPdf("t1", null)).rejects.toThrow(PDF_FAILED);
  });

  it("passes the server's message through", async () => {
    answer(
      Response.json(
        { error: { message: "Pick a company and a template first." } },
        { status: 400 },
      ),
    );
    await expect(requestTenderPdf("t1", null)).rejects.toThrow(
      "Pick a company and a template first.",
    );
  });
});
