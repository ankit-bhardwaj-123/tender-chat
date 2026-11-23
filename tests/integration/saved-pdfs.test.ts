import { rm } from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as fileRoute from "@/app/api/companies/[id]/files/[kind]/route";
import * as companiesRoute from "@/app/api/companies/route";
import * as savedPdfRoute from "@/app/api/tenders/[id]/saved-pdfs/[pdfId]/route";
import * as savedPdfsRoute from "@/app/api/tenders/[id]/saved-pdfs/route";
import * as tenderRoute from "@/app/api/tenders/[id]/route";
import * as tendersRoute from "@/app/api/tenders/route";
import * as templatesRoute from "@/app/api/templates/route";
import { storage } from "@/server/adapters/file-storage";
import { db } from "@/server/adapters/postgres";
import { savedPdf } from "@/server/schema";
import { eq } from "drizzle-orm";
import type { Company, CreatedTender, SavedPdf, Template, Tender } from "@/types";
import {
  apiRequest,
  createSignedInUser,
  deleteUsers,
  fileParams,
  idParams,
  jsonBody,
  type TestUser,
  uploadedFiles,
} from "./users";

const HTML = "<html><head></head><body><p>{{officer}}</p></body></html>";

let owner: TestUser;
let stranger: TestUser;

beforeAll(async () => {
  [owner, stranger] = await Promise.all([createSignedInUser(), createSignedInUser()]);
});

afterAll(async () => {
  await deleteUsers([owner, stranger]);
});

async function letterheadPdf(text: string): Promise<Uint8Array<ArrayBuffer>> {
  const doc = await PDFDocument.create();
  doc.addPage([595.28, 841.89]).drawText(text, { x: 40, y: 800 });
  return new Uint8Array(await doc.save());
}

async function putLetterhead(companyId: string, text: string) {
  const form = new FormData();
  form.append("file", new File([await letterheadPdf(text)], "head.pdf"));
  const res = await fileRoute.PUT(
    apiRequest(owner, "/x", { method: "PUT", body: form }),
    fileParams(companyId, "letterhead"),
  );
  expect(res.status).toBe(200);
}

async function setup(companyName: string): Promise<{ tender: Tender; company: Company }> {
  const companyRes = await companiesRoute.POST(
    apiRequest(owner, "/x", jsonBody("POST", { name: companyName })),
  );
  const company = (await companyRes.json()) as Company;
  await putLetterhead(company.id, "First letterhead");
  const form = new FormData();
  form.append("name", "Quote");
  form.append("language", "hi");
  form.append("file", new File([HTML], "q.html"));
  const templateRes = await templatesRoute.POST(
    apiRequest(owner, "/x", { method: "POST", body: form }),
  );
  const template = (await templateRes.json()) as Template;
  const created = await tendersRoute.POST(
    apiRequest(owner, "/x", jsonBody("POST", { name: "Road" })),
  );
  const { tender } = (await created.json()) as CreatedTender;
  const saved = await tenderRoute.PATCH(
    apiRequest(
      owner,
      "/x",
      jsonBody("PATCH", {
        companyId: company.id,
        templateId: template.id,
        values: { officer: "श्री राम" },
      }),
    ),
    idParams(tender.id),
  );
  return { tender: (await saved.json()) as Tender, company };
}

function save(as: TestUser, tenderId: string) {
  return savedPdfsRoute.POST(
    apiRequest(as, "/x", jsonBody("POST", { sealTop: null })),
    idParams(tenderId),
  );
}

function list(as: TestUser, tenderId: string) {
  return savedPdfsRoute.GET(apiRequest(as, "/x"), idParams(tenderId));
}

function open(as: TestUser, tenderId: string, pdfId: string) {
  return savedPdfRoute.GET(apiRequest(as, "/x"), {
    params: Promise.resolve({ id: tenderId, pdfId }),
  });
}

describe("saved PDFs", () => {
  it("names saves after the company, numbers the next ones, and lists newest first", async () => {
    const { tender } = await setup("Sharma Builders");
    const first = await save(owner, tender.id);
    expect(first.status).toBe(201);
    expect(((await first.json()) as SavedPdf).name).toBe("Sharma Builders");
    const second = (await (await save(owner, tender.id)).json()) as SavedPdf;
    expect(second.name).toBe("Sharma Builders 2");
    const names = ((await (await list(owner, tender.id)).json()) as SavedPdf[]).map((p) => p.name);
    expect(names).toEqual(["Sharma Builders 2", "Sharma Builders"]);
  }, 120000);

  it("keeps the saved file the same after the letterhead and template text change", async () => {
    const { tender, company } = await setup("Verma");
    const saved = (await (await save(owner, tender.id)).json()) as SavedPdf;
    const before = new Uint8Array(await (await open(owner, tender.id, saved.id)).arrayBuffer());
    expect(new TextDecoder().decode(before.slice(0, 5))).toBe("%PDF-");

    await putLetterhead(company.id, "Second letterhead");
    await tenderRoute.PATCH(
      apiRequest(owner, "/x", jsonBody("PATCH", { customHtml: "<p>changed</p>" })),
      idParams(tender.id),
    );
    const res = await open(owner, tender.id, saved.id);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toBe("inline; filename*=UTF-8''Verma.pdf");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(before);
  }, 120000);

  it("removes the stored file and says so when saving fails", async () => {
    const { tender } = await setup("Fails");
    const before = await uploadedFiles(owner.id);
    const spy = vi.spyOn(storage, "save").mockRejectedValueOnce(new Error("disk full"));
    const res = await save(owner, tender.id);
    spy.mockRestore();
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toBe("PDF generated but failed to save. Please try again.");
    expect((await uploadedFiles(owner.id)).sort()).toEqual([...before].sort());
    expect((await (await list(owner, tender.id)).json()) as SavedPdf[]).toEqual([]);
  }, 120000);

  it("deletes the saved files with the tender", async () => {
    const { tender } = await setup("Delete");
    const before = await uploadedFiles(owner.id);
    expect((await save(owner, tender.id)).status).toBe(201);
    expect((await uploadedFiles(owner.id)).length).toBeGreaterThan(before.length);
    await tenderRoute.DELETE(apiRequest(owner, "/x", { method: "DELETE" }), idParams(tender.id));
    expect((await uploadedFiles(owner.id)).sort()).toEqual([...before].sort());
  }, 120000);

  it("answers 404 for another user and for a missing file", async () => {
    const { tender } = await setup("Private");
    const saved = (await (await save(owner, tender.id)).json()) as SavedPdf;
    expect((await list(stranger, tender.id)).status).toBe(404);
    expect((await save(stranger, tender.id)).status).toBe(404);
    expect((await open(stranger, tender.id, saved.id)).status).toBe(404);

    const [row] = await db.select().from(savedPdf).where(eq(savedPdf.id, saved.id));
    await rm(path.resolve("storage", row?.storageKey ?? "missing"));
    expect((await open(owner, tender.id, saved.id)).status).toBe(404);
  }, 120000);
});
