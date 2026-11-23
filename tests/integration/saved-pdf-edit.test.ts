import { PDFDocument } from "pdf-lib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as fileRoute from "@/app/api/companies/[id]/files/[kind]/route";
import * as companiesRoute from "@/app/api/companies/route";
import * as imageRoute from "@/app/api/tenders/[id]/images/[imageId]/route";
import * as imagesRoute from "@/app/api/tenders/[id]/images/route";
import * as editRoute from "@/app/api/tenders/[id]/saved-pdfs/[pdfId]/edit/route";
import * as partRoute from "@/app/api/tenders/[id]/saved-pdfs/[pdfId]/parts/[kind]/route";
import * as savedPdfRoute from "@/app/api/tenders/[id]/saved-pdfs/[pdfId]/route";
import * as savedPdfsRoute from "@/app/api/tenders/[id]/saved-pdfs/route";
import * as tenderRoute from "@/app/api/tenders/[id]/route";
import * as tendersRoute from "@/app/api/tenders/route";
import * as templatesRoute from "@/app/api/templates/route";
import { db } from "@/server/adapters/postgres";
import { savedPdf } from "@/server/schema";
import { eq } from "drizzle-orm";
import type { Company, CreatedTender, SavedPdf, Template, Tender, TenderImage } from "@/types";
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
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9, 9]);

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

async function putLetterhead(companyId: string, bytes: Uint8Array<ArrayBuffer>) {
  const form = new FormData();
  form.append("file", new File([bytes], "head.pdf"));
  const res = await fileRoute.PUT(
    apiRequest(owner, "/x", { method: "PUT", body: form }),
    fileParams(companyId, "letterhead"),
  );
  expect(res.status).toBe(200);
}

interface Setup {
  tender: Tender;
  company: Company;
  firstLetterhead: Uint8Array<ArrayBuffer>;
}

async function setup(companyName: string): Promise<Setup> {
  const companyRes = await companiesRoute.POST(
    apiRequest(owner, "/x", jsonBody("POST", { name: companyName })),
  );
  const company = (await companyRes.json()) as Company;
  const firstLetterhead = await letterheadPdf("First letterhead");
  await putLetterhead(company.id, firstLetterhead);
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
  const tender2 = await patch(tender.id, {
    companyId: company.id,
    templateId: template.id,
    values: { officer: "पुराना" },
  });
  return { tender: tender2, company, firstLetterhead };
}

async function patch(tenderId: string, body: object): Promise<Tender> {
  const res = await tenderRoute.PATCH(
    apiRequest(owner, "/x", jsonBody("PATCH", body)),
    idParams(tenderId),
  );
  expect(res.status).toBe(200);
  return (await res.json()) as Tender;
}

function pdfParams(id: string, pdfId: string) {
  return { params: Promise.resolve({ id, pdfId }) };
}

async function save(tenderId: string, name?: string): Promise<SavedPdf> {
  const res = await savedPdfsRoute.POST(
    apiRequest(owner, "/x", jsonBody("POST", { sealTop: null, name })),
    idParams(tenderId),
  );
  expect(res.status).toBe(201);
  return (await res.json()) as SavedPdf;
}

function edit(as: TestUser, tenderId: string, pdfId: string) {
  return editRoute.POST(apiRequest(as, "/x", { method: "POST" }), pdfParams(tenderId, pdfId));
}

function replace(as: TestUser, tenderId: string, pdfId: string, name?: string) {
  return savedPdfRoute.PUT(
    apiRequest(as, "/x", jsonBody("PUT", { sealTop: null, name })),
    pdfParams(tenderId, pdfId),
  );
}

function part(as: TestUser, tenderId: string, pdfId: string, kind: string) {
  return partRoute.GET(apiRequest(as, "/x"), {
    params: Promise.resolve({ id: tenderId, pdfId, kind }),
  });
}

async function list(tenderId: string): Promise<SavedPdf[]> {
  const res = await savedPdfsRoute.GET(apiRequest(owner, "/x"), idParams(tenderId));
  return (await res.json()) as SavedPdf[];
}

describe("naming saved PDFs", () => {
  it("keeps a given name and uses the suggested one when the name is empty", async () => {
    const { tender } = await setup("Naming Co");
    expect((await save(tender.id, "  My   quote ")).name).toBe("My quote");
    expect((await save(tender.id, "")).name).toBe("Naming Co");
    expect((await save(tender.id)).name).toBe("Naming Co 2");
  }, 120000);
});

describe("editing a saved PDF", () => {
  it("brings back the old values, letterhead and an image deleted since", async () => {
    const { tender, company, firstLetterhead } = await setup("Edit Co");
    const form = new FormData();
    form.append("file", new File([PNG], "a.png"));
    const uploaded = await imagesRoute.POST(
      apiRequest(owner, "/x", { method: "POST", body: form }),
      idParams(tender.id),
    );
    const image = (await uploaded.json()) as TenderImage;
    await patch(tender.id, {
      canvas: {
        items: [
          {
            id: "i1",
            kind: "image",
            x: 10,
            y: 50,
            width: 40,
            height: 30,
            text: "",
            imageId: image.id,
          },
        ],
        seal: { shown: true, x: null, y: null, width: 35 },
      },
    });
    const saved = await save(tender.id, "Before");
    expect(saved.editable).toBe(true);
    expect(saved.hasLetterhead).toBe(true);

    await putLetterhead(company.id, await letterheadPdf("Second letterhead"));
    await patch(tender.id, {
      values: { officer: "नया" },
      canvas: { items: [], seal: { shown: true, x: null, y: null, width: 35 } },
    });
    await imageRoute.DELETE(apiRequest(owner, "/x", { method: "DELETE" }), {
      params: Promise.resolve({ id: tender.id, imageId: image.id }),
    });

    const res = await edit(owner, tender.id, saved.id);
    expect(res.status).toBe(200);
    const editing = (await res.json()) as Tender;
    expect(editing.editingPdfId).toBe(saved.id);
    expect(editing.values).toEqual({ officer: "पुराना" });
    expect(editing.customHtml).toBe(HTML);
    expect(editing.canvas.items[0]?.imageId).toBe(image.id);

    const restored = await imageRoute.GET(apiRequest(owner, "/x"), {
      params: Promise.resolve({ id: tender.id, imageId: image.id }),
    });
    expect(restored.status).toBe(200);
    const head = await part(owner, tender.id, saved.id, "letterhead");
    expect(new Uint8Array(await head.arrayBuffer())).toEqual(firstLetterhead);
  }, 180000);

  it("replaces in place, or saves a new one that keeps the old letterhead", async () => {
    const { tender, company, firstLetterhead } = await setup("Replace Co");
    const saved = await save(tender.id, "Original");
    const [before] = await db.select().from(savedPdf).where(eq(savedPdf.id, saved.id));
    await putLetterhead(company.id, await letterheadPdf("Changed letterhead"));
    expect((await edit(owner, tender.id, saved.id)).status).toBe(200);

    const filesBefore = await uploadedFiles(owner.id);
    const replacedRes = await replace(owner, tender.id, saved.id);
    expect(replacedRes.status).toBe(200);
    const replaced = (await replacedRes.json()) as SavedPdf;
    expect(replaced.id).toBe(saved.id);
    expect(replaced.name).toBe("Original");
    expect(replaced.editedAt).not.toBeNull();
    const [after] = await db.select().from(savedPdf).where(eq(savedPdf.id, saved.id));
    expect(after?.storageKey).not.toBe(before?.storageKey);
    const filesAfter = await uploadedFiles(owner.id);
    expect(filesAfter).not.toContain(path(before?.storageKey));
    expect(filesAfter.length).toBe(filesBefore.length);

    const asNew = await save(tender.id, "Copy");
    expect((await list(tender.id)).map((pdf) => pdf.name)).toEqual(["Copy", "Original"]);
    const head = await part(owner, tender.id, asNew.id, "letterhead");
    expect(new Uint8Array(await head.arrayBuffer())).toEqual(firstLetterhead);
    const tenderRes = await tenderRoute.GET(apiRequest(owner, "/x"), idParams(tender.id));
    expect(((await tenderRes.json()) as Tender).editingPdfId).toBe(asNew.id);

    const done = await patch(tender.id, { editingPdfId: null });
    expect(done.editingPdfId).toBeNull();
  }, 240000);

  it("refuses an old PDF without a copy, and another user's PDF", async () => {
    const { tender } = await setup("Old Co");
    const saved = await save(tender.id);
    await db.update(savedPdf).set({ snapshot: null }).where(eq(savedPdf.id, saved.id));
    const old = await edit(owner, tender.id, saved.id);
    expect(old.status).toBe(400);
    expect(((await old.json()) as { error: { message: string } }).error.message).toBe(
      "Saved before editing was possible.",
    );
    expect((await edit(stranger, tender.id, saved.id)).status).toBe(404);
    expect((await replace(stranger, tender.id, saved.id)).status).toBe(404);
    expect((await part(stranger, tender.id, saved.id, "letterhead")).status).toBe(404);
    expect((await part(owner, tender.id, saved.id, "template")).status).toBe(404);
  }, 120000);

  it("removes the PDF and copy files when the tender is deleted", async () => {
    const { tender } = await setup("Delete Co");
    const before = await uploadedFiles(owner.id);
    await save(tender.id);
    expect((await uploadedFiles(owner.id)).length).toBeGreaterThan(before.length + 1);
    const res = await tenderRoute.DELETE(
      apiRequest(owner, "/x", { method: "DELETE" }),
      idParams(tender.id),
    );
    expect(res.status).toBe(204);
    expect((await uploadedFiles(owner.id)).sort()).toEqual([...before].sort());
  }, 120000);
});

function path(key: string | undefined): string {
  return (key ?? "").split("/").pop() ?? "";
}
