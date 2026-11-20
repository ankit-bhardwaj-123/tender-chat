import { PDFDocument } from "pdf-lib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as fileRoute from "@/app/api/companies/[id]/files/[kind]/route";
import * as companiesRoute from "@/app/api/companies/route";
import * as imagesRoute from "@/app/api/tenders/[id]/images/route";
import * as pdfRoute from "@/app/api/tenders/[id]/pdf/route";
import * as tenderRoute from "@/app/api/tenders/[id]/route";
import * as tendersRoute from "@/app/api/tenders/route";
import * as templatesRoute from "@/app/api/templates/route";
import { findTenderImage } from "@/repositories/tender-image.repository";
import { storage } from "@/server/adapters/file-storage";
import type { Company, Template, Tender, TenderImage } from "@/types";
import {
  apiRequest,
  createSignedInUser,
  deleteUsers,
  fileParams,
  idParams,
  jsonBody,
  type TestUser,
} from "./users";

const HTML = "<html><head></head><body><p>{{officer}} {{rate}}</p></body></html>";
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9, 9]);

let owner: TestUser;
let stranger: TestUser;
let letterhead: Uint8Array<ArrayBuffer>;

beforeAll(async () => {
  [owner, stranger] = await Promise.all([createSignedInUser(), createSignedInUser()]);
  const doc = await PDFDocument.create();
  doc.addPage([595.28, 841.89]).drawText("Letterhead", { x: 40, y: 800 });
  letterhead = new Uint8Array(await doc.save());
});

afterAll(async () => {
  await deleteUsers([owner, stranger]);
});

async function putFile(
  companyId: string,
  kind: string,
  bytes: Uint8Array<ArrayBuffer>,
  name: string,
) {
  const form = new FormData();
  form.append("file", new File([bytes], name));
  const res = await fileRoute.PUT(
    apiRequest(owner, "/x", { method: "PUT", body: form }),
    fileParams(companyId, kind),
  );
  expect(res.status).toBe(200);
}

async function createCompany(withLetterhead: boolean): Promise<Company> {
  const res = await companiesRoute.POST(
    apiRequest(owner, "/x", jsonBody("POST", { name: "Firm" })),
  );
  expect(res.status).toBe(201);
  const company = (await res.json()) as Company;
  if (withLetterhead) await putFile(company.id, "letterhead", letterhead, "head.pdf");
  return company;
}

async function createTemplate(html: string): Promise<Template> {
  const form = new FormData();
  form.append("name", "Quote");
  form.append("language", "hi");
  form.append("file", new File([html], "q.html"));
  const res = await templatesRoute.POST(apiRequest(owner, "/x", { method: "POST", body: form }));
  expect(res.status).toBe(201);
  return (await res.json()) as Template;
}

async function createTender(name: string, changes: Record<string, unknown>): Promise<Tender> {
  const res = await tendersRoute.POST(apiRequest(owner, "/x", jsonBody("POST", { name })));
  expect(res.status).toBe(201);
  const tender = (await res.json()) as Tender;
  const saved = await tenderRoute.PATCH(
    apiRequest(owner, "/x", jsonBody("PATCH", changes)),
    idParams(tender.id),
  );
  expect(saved.status).toBe(200);
  return (await saved.json()) as Tender;
}

function makePdf(as: TestUser | null, tenderId: string, sealTop: number | null = null) {
  return pdfRoute.POST(apiRequest(as, "/x", jsonBody("POST", { sealTop })), idParams(tenderId));
}

async function pageCount(res: Response): Promise<number> {
  return (await PDFDocument.load(new Uint8Array(await res.arrayBuffer()))).getPageCount();
}

async function errorMessage(res: Response): Promise<string | undefined> {
  return ((await res.json()) as { error?: { message?: string } }).error?.message;
}

describe("tender PDF", () => {
  it("prints a filled tender as one page named after the tender", async () => {
    const company = await createCompany(true);
    const template = await createTemplate(HTML);
    const tender = await createTender("Road repair", {
      companyId: company.id,
      templateId: template.id,
      values: { officer: "श्री राम" },
    });
    const res = await makePdf(owner, tender.id, 40);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toBe(
      "attachment; filename*=UTF-8''Road%20repair.pdf",
    );
    expect(await pageCount(res)).toBe(1);
  }, 60000);

  it("prints an edited page with a script without running it, and a long page on 2 pages", async () => {
    const company = await createCompany(true);
    const template = await createTemplate(HTML);
    const long = `<html><head></head><body><script>document.body.innerHTML=""</script>${"<p>पंक्ति</p>".repeat(40)}</body></html>`;
    const tender = await createTender("Long", { companyId: company.id, templateId: template.id });
    const edited = await tenderRoute.PATCH(
      apiRequest(owner, "/x", jsonBody("PATCH", { customHtml: long })),
      idParams(tender.id),
    );
    expect(edited.status).toBe(200);
    const res = await makePdf(owner, tender.id);
    expect(res.status).toBe(200);
    expect(await pageCount(res)).toBe(2);
  }, 60000);

  it("still prints when the seal or an added image file is missing", async () => {
    const company = await createCompany(true);
    await putFile(company.id, "seal", JPG, "seal.jpg");
    const template = await createTemplate(HTML);
    const tender = await createTender("Missing", {
      companyId: company.id,
      templateId: template.id,
    });
    const form = new FormData();
    form.append("file", new File([PNG], "a.png"));
    const uploaded = await imagesRoute.POST(
      apiRequest(owner, "/x", { method: "POST", body: form }),
      idParams(tender.id),
    );
    const image = (await uploaded.json()) as TenderImage;
    const row = await findTenderImage(tender.id, image.id);
    if (row) await storage.delete(row.storageKey);
    await tenderRoute.PATCH(
      apiRequest(
        owner,
        "/x",
        jsonBody("PATCH", {
          canvas: {
            items: [
              {
                id: "i1",
                kind: "image",
                x: 10,
                y: 400,
                width: 40,
                height: 30,
                text: "",
                imageId: image.id,
              },
            ],
            seal: { shown: true, x: null, y: null, width: 35 },
          },
        }),
      ),
      idParams(tender.id),
    );
    const res = await makePdf(owner, tender.id, 60);
    expect(res.status).toBe(200);
    expect(await pageCount(res)).toBe(1);
  }, 60000);

  it("needs a company, a template and a letterhead", async () => {
    const template = await createTemplate(HTML);
    const none = await createTender("None", { companyId: null, templateId: template.id });
    const noCompany = await makePdf(owner, none.id);
    expect(noCompany.status).toBe(400);
    expect(await errorMessage(noCompany)).toBe("Pick a company and a template first.");

    const bare = await createCompany(false);
    const tender = await createTender("Bare", { companyId: bare.id, templateId: template.id });
    const noHead = await makePdf(owner, tender.id);
    expect(noHead.status).toBe(400);
    expect(await errorMessage(noHead)).toBe(
      "The letterhead file is missing. Upload it again in Companies.",
    );

    const broken = await createCompany(false);
    await putFile(
      broken.id,
      "letterhead",
      new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 1, 2]),
      "bad.pdf",
    );
    const brokenTender = await createTender("Broken", {
      companyId: broken.id,
      templateId: template.id,
    });
    const badHead = await makePdf(owner, brokenTender.id);
    expect(badHead.status).toBe(400);
    expect(await errorMessage(badHead)).toBe(
      "The letterhead PDF can't be read. Upload it again in Companies.",
    );
  });

  it("answers 404 for another user's tender and 401 without a session", async () => {
    const tender = await createTender("Mine", {});
    expect((await makePdf(stranger, tender.id)).status).toBe(404);
    expect((await makePdf(owner, "not-a-uuid")).status).toBe(404);
    expect((await makePdf(null, tender.id)).status).toBe(401);
  });
});
