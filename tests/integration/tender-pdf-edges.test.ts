import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { PDFDocument } from "pdf-lib";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as fileRoute from "@/app/api/companies/[id]/files/[kind]/route";
import * as companyRoute from "@/app/api/companies/[id]/route";
import * as companiesRoute from "@/app/api/companies/route";
import * as pdfRoute from "@/app/api/tenders/[id]/pdf/route";
import * as tenderRoute from "@/app/api/tenders/[id]/route";
import * as tendersRoute from "@/app/api/tenders/route";
import * as templateRoute from "@/app/api/templates/[id]/route";
import * as templatesRoute from "@/app/api/templates/route";
import { findCompanyFile } from "@/repositories/company.repository";
import { storage } from "@/server/adapters/file-storage";
import type { Company, Template, Tender } from "@/types";
import {
  apiRequest,
  createSignedInUser,
  deleteUsers,
  fileParams,
  idParams,
  jsonBody,
  type TestUser,
} from "./users";

const HTML = "<html><head></head><body><p>{{officer}}</p></body></html>";

let owner: TestUser;
let letterhead: Uint8Array<ArrayBuffer>;
let server: Server;
let origin = "";
let connections = 0;
const requested: string[] = [];

beforeAll(async () => {
  owner = await createSignedInUser();
  const doc = await PDFDocument.create();
  doc.addPage([595.28, 841.89]).drawText("Letterhead", { x: 40, y: 800 });
  letterhead = new Uint8Array(await doc.save());
  server = createServer((req, res) => {
    requested.push(req.url ?? "");
    res.end("x");
  });
  server.on("connection", () => {
    connections += 1;
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

beforeEach(() => {
  connections = 0;
  requested.length = 0;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await deleteUsers([owner]);
});

async function createCompany(): Promise<Company> {
  const res = await companiesRoute.POST(
    apiRequest(owner, "/x", jsonBody("POST", { name: "Firm" })),
  );
  const company = (await res.json()) as Company;
  const form = new FormData();
  form.append("file", new File([letterhead], "head.pdf"));
  const put = await fileRoute.PUT(
    apiRequest(owner, "/x", { method: "PUT", body: form }),
    fileParams(company.id, "letterhead"),
  );
  expect(put.status).toBe(200);
  return company;
}

async function createTemplate(): Promise<Template> {
  const form = new FormData();
  form.append("name", "Quote");
  form.append("language", "hi");
  form.append("file", new File([HTML], "q.html"));
  const res = await templatesRoute.POST(apiRequest(owner, "/x", { method: "POST", body: form }));
  return (await res.json()) as Template;
}

async function createTender(name: string, changes: Record<string, unknown>): Promise<Tender> {
  const res = await tendersRoute.POST(apiRequest(owner, "/x", jsonBody("POST", { name })));
  const tender = (await res.json()) as Tender;
  const saved = await tenderRoute.PATCH(
    apiRequest(owner, "/x", jsonBody("PATCH", changes)),
    idParams(tender.id),
  );
  expect(saved.status).toBe(200);
  return (await saved.json()) as Tender;
}

async function readyTender(name: string, extra: Record<string, unknown> = {}) {
  const [company, template] = await Promise.all([createCompany(), createTemplate()]);
  const tender = await createTender(name, {
    companyId: company.id,
    templateId: template.id,
    ...extra,
  });
  return { company, template, tender };
}

function makePdf(tenderId: string, body: unknown) {
  return pdfRoute.POST(apiRequest(owner, "/x", jsonBody("POST", body)), idParams(tenderId));
}

async function errorMessage(res: Response): Promise<string | undefined> {
  return ((await res.json()) as { error?: { message?: string } }).error?.message;
}

describe("tender PDF edges", () => {
  it("answers 400 when the tender has a company but no template", async () => {
    const company = await createCompany();
    const tender = await createTender("No template", { companyId: company.id, templateId: null });
    const res = await makePdf(tender.id, { sealTop: null });
    expect(res.status).toBe(400);
    expect(await errorMessage(res)).toBe("Pick a company and a template first.");
  });

  it("answers 404 when the chosen company or template was deleted", async () => {
    const first = await readyTender("Deleted company");
    await companyRoute.DELETE(
      apiRequest(owner, "/x", { method: "DELETE" }),
      idParams(first.company.id),
    );
    expect((await makePdf(first.tender.id, { sealTop: null })).status).toBe(404);

    const second = await readyTender("Deleted template");
    await templateRoute.DELETE(
      apiRequest(owner, "/x", { method: "DELETE" }),
      idParams(second.template.id),
    );
    expect((await makePdf(second.tender.id, { sealTop: null })).status).toBe(404);
  });

  it("answers 400 with the letterhead message when the letterhead file is gone from storage", async () => {
    const { company, tender } = await readyTender("Lost letterhead");
    const row = await findCompanyFile(company.id, "letterhead");
    if (row) await storage.delete(row.storageKey);
    const res = await makePdf(tender.id, { sealTop: null });
    expect(res.status).toBe(400);
    expect(await errorMessage(res)).toBe(
      "The letterhead file is missing. Upload it again in Companies.",
    );
  });

  it("answers 400 for a bad body", async () => {
    const tender = await createTender("Bad body", {});
    expect((await makePdf(tender.id, { sealTop: "120" })).status).toBe(400);
    expect((await makePdf(tender.id, {})).status).toBe(400);
    const notJson = await pdfRoute.POST(
      apiRequest(owner, "/x", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      }),
      idParams(tender.id),
    );
    expect(notJson.status).toBe(400);
  });

  it("removes characters a file name can't hold, including the backslash", async () => {
    const { tender } = await readyTender('सड़क\\मरम्मत: "A"/B?');
    const res = await makePdf(tender.id, { sealTop: 40 });
    expect(res.status).toBe(200);
    const header = res.headers.get("Content-Disposition") ?? "";
    const name = decodeURIComponent(header.replace("attachment; filename*=UTF-8''", ""));
    expect(name).toBe("सड़कमरम्मत AB.pdf");
  }, 60000);

  it("prints a script, an empty blank and Hindi values in an edited page without leaking", async () => {
    const custom = `<html><head></head><body><p>{{officer}} {{missing}}</p><script>x()</script><p>{{rate}}</p></body></html>`;
    const { tender } = await readyTender("Hindi", {
      values: { officer: "श्री राम <b>&</b>", rate: "{{officer}}" },
    });
    await tenderRoute.PATCH(
      apiRequest(owner, "/x", jsonBody("PATCH", { customHtml: custom })),
      idParams(tender.id),
    );
    const res = await makePdf(tender.id, { sealTop: null });
    expect(res.status).toBe(200);
    const doc = await PDFDocument.load(new Uint8Array(await res.arrayBuffer()));
    expect(doc.getPageCount()).toBe(1);
  }, 60000);

  it("makes no network request for a prefetch link in an edited page", async () => {
    const custom = `<html><head><link rel="prefetch" href="${origin}/leak"></head><body><p>x</p></body></html>`;
    const { tender } = await readyTender("Prefetch", {});
    await tenderRoute.PATCH(
      apiRequest(owner, "/x", jsonBody("PATCH", { customHtml: custom })),
      idParams(tender.id),
    );
    const res = await makePdf(tender.id, { sealTop: null });
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(res.status).toBe(200);
    expect(requested).toEqual([]);
    expect(connections).toBe(0);
  }, 60000);

  it("still prints an edited page that has a meta refresh", async () => {
    const custom = `<html><head><meta http-equiv="refresh" content="0;url=${origin}/go"></head><body><p>x</p></body></html>`;
    const { tender } = await readyTender("Refresh", {});
    await tenderRoute.PATCH(
      apiRequest(owner, "/x", jsonBody("PATCH", { customHtml: custom })),
      idParams(tender.id),
    );
    const res = await makePdf(tender.id, { sealTop: null });
    expect(res.status).toBe(200);
    expect(requested).toEqual([]);
  }, 60000);
});
