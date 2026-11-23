import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as companyRoute from "@/app/api/companies/[id]/route";
import * as companiesRoute from "@/app/api/companies/route";
import * as templateRoute from "@/app/api/templates/[id]/route";
import * as templatesRoute from "@/app/api/templates/route";
import * as tenderRoute from "@/app/api/tenders/[id]/route";
import * as tendersRoute from "@/app/api/tenders/route";
import type { Company, Template, CreatedTender, Tender } from "@/types";
import {
  apiRequest,
  createSignedInUser,
  deleteUsers,
  idParams,
  jsonBody,
  type TestUser,
} from "./users";

const HTML = "<html><body><p>{{officer}} {{rate}}</p></body></html>";

let owner: TestUser;
let stranger: TestUser;
let empty: TestUser;

beforeAll(async () => {
  [owner, stranger, empty] = await Promise.all([
    createSignedInUser(),
    createSignedInUser(),
    createSignedInUser(),
  ]);
});

afterAll(async () => {
  await deleteUsers([owner, stranger, empty]);
});

async function createCompany(as: TestUser, name: string): Promise<Company> {
  const res = await companiesRoute.POST(apiRequest(as, "/x", jsonBody("POST", { name })));
  expect(res.status).toBe(201);
  return (await res.json()) as Company;
}

async function createTemplate(as: TestUser, name: string): Promise<Template> {
  const form = new FormData();
  form.append("name", name);
  form.append("language", "hi");
  form.append("file", new File([HTML], "q.html"));
  const res = await templatesRoute.POST(apiRequest(as, "/x", { method: "POST", body: form }));
  expect(res.status).toBe(201);
  return (await res.json()) as Template;
}

async function createTender(as: TestUser, name = "Road"): Promise<Tender> {
  const res = await tendersRoute.POST(apiRequest(as, "/x", jsonBody("POST", { name })));
  expect(res.status).toBe(201);
  return ((await res.json()) as CreatedTender).tender;
}

function patch(as: TestUser, tenderId: string, body: unknown): Promise<Response> {
  return tenderRoute.PATCH(apiRequest(as, "/x", jsonBody("PATCH", body)), idParams(tenderId));
}

async function read(as: TestUser, tenderId: string): Promise<Response> {
  return tenderRoute.GET(apiRequest(as, "/x"), idParams(tenderId));
}

describe("tender editor API", () => {
  it("starts a new tender with no company or template when the user has none", async () => {
    const tender = await createTender(empty);
    expect(tender).toMatchObject({
      type: "quotation",
      companyId: null,
      templateId: null,
      values: {},
    });
  });

  it("starts a new tender with the first company and first template", async () => {
    const first = await createCompany(owner, "First");
    await createCompany(owner, "Second");
    const firstTemplate = await createTemplate(owner, "T1");
    await createTemplate(owner, "T2");
    const tender = await createTender(owner);
    expect(tender.companyId).toBe(first.id);
    expect(tender.templateId).toBe(firstTemplate.id);
  });

  it("saves values and reads them back, and a name-only change keeps them", async () => {
    const tender = await createTender(owner);
    const values = { officer: "श्री राम", rate: "1,200\nonly" };
    const saved = await patch(owner, tender.id, { values });
    expect(saved.status).toBe(200);
    expect(((await saved.json()) as Tender).values).toEqual(values);

    const renamed = await patch(owner, tender.id, { name: "Bridge" });
    const after = (await renamed.json()) as Tender;
    expect(after.name).toBe("Bridge");
    expect(after.values).toEqual(values);
    expect(after.companyId).toBe(tender.companyId);
    expect(after.templateId).toBe(tender.templateId);

    const reread = (await (await read(owner, tender.id)).json()) as Tender;
    expect(reread.values).toEqual(values);
  });

  it("changes the template and its values together, and null clears both ids", async () => {
    const tender = await createTender(owner);
    const other = await createTemplate(owner, "Other");
    const changed = (await (
      await patch(owner, tender.id, { templateId: other.id, values: { officer: "A" } })
    ).json()) as Tender;
    expect(changed.templateId).toBe(other.id);
    expect(changed.values).toEqual({ officer: "A" });

    const cleared = (await (
      await patch(owner, tender.id, { companyId: null, templateId: null })
    ).json()) as Tender;
    expect(cleared.companyId).toBeNull();
    expect(cleared.templateId).toBeNull();
  });

  it("answers 404 for another user's company or template and changes nothing", async () => {
    const tender = await createTender(owner);
    const theirCompany = await createCompany(stranger, "Theirs");
    const theirTemplate = await createTemplate(stranger, "Theirs");

    const byCompany = await patch(owner, tender.id, { companyId: theirCompany.id });
    expect(byCompany.status).toBe(404);
    const byTemplate = await patch(owner, tender.id, {
      templateId: theirTemplate.id,
      values: { officer: "x" },
    });
    expect(byTemplate.status).toBe(404);

    const after = (await (await read(owner, tender.id)).json()) as Tender;
    expect(after.companyId).toBe(tender.companyId);
    expect(after.templateId).toBe(tender.templateId);
    expect(after.values).toEqual({});
  });

  it("answers 404 for a deleted company or template", async () => {
    const tender = await createTender(owner);
    const gone = await createCompany(owner, "Gone");
    await companyRoute.DELETE(apiRequest(owner, "/x", { method: "DELETE" }), idParams(gone.id));
    const goneTemplate = await createTemplate(owner, "Gone");
    await templateRoute.DELETE(
      apiRequest(owner, "/x", { method: "DELETE" }),
      idParams(goneTemplate.id),
    );

    expect((await patch(owner, tender.id, { companyId: gone.id })).status).toBe(404);
    expect((await patch(owner, tender.id, { templateId: goneTemplate.id })).status).toBe(404);
  });

  it("answers 404 when another user reads or changes the tender", async () => {
    const tender = await createTender(owner);
    expect((await read(stranger, tender.id)).status).toBe(404);
    expect((await patch(stranger, tender.id, { values: { officer: "taken" } })).status).toBe(404);
    const after = (await (await read(owner, tender.id)).json()) as Tender;
    expect(after.values).toEqual({});
  });

  it("refuses a bad body with 400", async () => {
    const tender = await createTender(owner);
    expect((await patch(owner, tender.id, { companyId: "nope" })).status).toBe(400);
    expect((await patch(owner, tender.id, { values: { a: 1 } })).status).toBe(400);
    expect((await patch(owner, tender.id, { name: "   " })).status).toBe(400);
  });

  it("gives a new tender the default canvas and no edited page", async () => {
    const tender = await createTender(owner);
    expect(tender.customHtml).toBeNull();
    expect(tender.canvas).toEqual({
      items: [],
      seal: { shown: true, x: null, y: null, width: 35 },
    });
  });

  it("saves the edited page and the canvas and reads them back", async () => {
    const tender = await createTender(owner);
    const canvas = {
      items: [
        {
          id: "a",
          kind: "text",
          x: 20,
          y: 330,
          width: 70,
          height: 10,
          text: "नमस्ते",
          imageId: null,
        },
      ],
      seal: { shown: true, x: 140, y: 200, width: 40 },
    };
    const body = { customHtml: "<p>{{officer}} edited</p>", canvas };
    expect((await patch(owner, tender.id, body)).status).toBe(200);
    const saved = (await (await read(owner, tender.id)).json()) as Tender;
    expect(saved.customHtml).toBe("<p>{{officer}} edited</p>");
    expect(saved.canvas).toEqual(canvas);
  });

  it("clears the edited page but keeps the canvas when the template really changes", async () => {
    const first = await createTemplate(owner, "First");
    const second = await createTemplate(owner, "Second");
    const tender = await createTender(owner);
    await patch(owner, tender.id, { templateId: first.id });
    const canvas = {
      items: [
        { id: "a", kind: "text", x: 10, y: 10, width: 70, height: 10, text: "x", imageId: null },
      ],
      seal: { shown: false, x: null, y: null, width: 35 },
    };
    await patch(owner, tender.id, { customHtml: "<p>mine</p>", canvas });
    const same = (await (await patch(owner, tender.id, { templateId: first.id })).json()) as Tender;
    expect(same.customHtml).toBe("<p>mine</p>");
    const changed = (await (
      await patch(owner, tender.id, { templateId: second.id })
    ).json()) as Tender;
    expect(changed.customHtml).toBeNull();
    expect(changed.canvas).toEqual(canvas);
  });

  it("keeps the edited page and the canvas when the company changes", async () => {
    const a = await createCompany(owner, "A Co");
    const b = await createCompany(owner, "B Co");
    const tender = await createTender(owner);
    await patch(owner, tender.id, { companyId: a.id });
    const canvas = { items: [], seal: { shown: true, x: 100, y: 120, width: 35 } };
    await patch(owner, tender.id, { customHtml: "<p>kept</p>", canvas });
    const changed = (await (await patch(owner, tender.id, { companyId: b.id })).json()) as Tender;
    expect(changed.companyId).toBe(b.id);
    expect(changed.customHtml).toBe("<p>kept</p>");
    expect(changed.canvas).toEqual(canvas);
  });
});
