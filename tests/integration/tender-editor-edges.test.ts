import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as companyRoute from "@/app/api/companies/[id]/route";
import * as companiesRoute from "@/app/api/companies/route";
import * as templateRoute from "@/app/api/templates/[id]/route";
import * as templatesRoute from "@/app/api/templates/route";
import * as tenderRoute from "@/app/api/tenders/[id]/route";
import * as tendersRoute from "@/app/api/tenders/route";
import { db } from "@/server/adapters/postgres";
import { tender as tenderTable } from "@/server/schema";
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
const MISSING_ID = "3f1c2b8e-4d5a-4c6b-9e7f-1a2b3c4d5e6f";

let owner: TestUser;
let stranger: TestUser;

beforeAll(async () => {
  [owner, stranger] = await Promise.all([createSignedInUser(), createSignedInUser()]);
});

afterAll(async () => {
  await deleteUsers([owner, stranger]);
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

function patch(as: TestUser | null, tenderId: string, body: unknown): Promise<Response> {
  return tenderRoute.PATCH(apiRequest(as, "/x", jsonBody("PATCH", body)), idParams(tenderId));
}

function read(as: TestUser | null, tenderId: string): Promise<Response> {
  return tenderRoute.GET(apiRequest(as, "/x"), idParams(tenderId));
}

async function storedRow(tenderId: string) {
  const [row] = await db.select().from(tenderTable).where(eq(tenderTable.id, tenderId));
  return row;
}

describe("tender editor API edges", () => {
  it("answers 401 on GET and PATCH when signed out and changes nothing", async () => {
    const tender = await createTender(owner);
    expect((await read(null, tender.id)).status).toBe(401);
    const res = await patch(null, tender.id, { values: { officer: "x" } });
    expect(res.status).toBe(401);
    expect((await storedRow(tender.id))?.values).toEqual({});
  });

  it("answers 404 for a missing or malformed tender id", async () => {
    expect((await read(owner, MISSING_ID)).status).toBe(404);
    expect((await patch(owner, MISSING_ID, { name: "x" })).status).toBe(404);
    expect((await read(owner, "../etc")).status).toBe(404);
    expect((await patch(owner, "not-a-uuid", { name: "x" })).status).toBe(404);
  });

  it("answers 404 for a company id that doesn't exist", async () => {
    const tender = await createTender(owner);
    const res = await patch(owner, tender.id, { companyId: MISSING_ID });
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toBe("Company not found.");
  });

  it("gives the same 404 for another user's company as for a missing one", async () => {
    const tender = await createTender(owner);
    const theirs = await createCompany(stranger, "Theirs");
    const theirTemplate = await createTemplate(stranger, "Theirs");
    const byCompany = (await (await patch(owner, tender.id, { companyId: theirs.id })).json()) as {
      error: { message: string };
    };
    const byTemplate = (await (
      await patch(owner, tender.id, { templateId: theirTemplate.id })
    ).json()) as { error: { message: string } };
    expect(byCompany).toEqual({ error: { message: "Company not found." } });
    expect(byTemplate).toEqual({ error: { message: "Template not found." } });
  });

  it("writes nothing when one id in a mixed PATCH belongs to another user", async () => {
    const tender = await createTender(owner);
    const mine = await createTemplate(owner, "Mine");
    const theirs = await createCompany(stranger, "Theirs");
    const before = await storedRow(tender.id);
    const res = await patch(owner, tender.id, {
      name: "Changed",
      templateId: mine.id,
      companyId: theirs.id,
      values: { officer: "x" },
    });
    expect(res.status).toBe(404);
    const after = await storedRow(tender.id);
    expect(after?.name).toBe("Road");
    expect(after?.templateId).toBe(before?.templateId);
    expect(after?.values).toEqual({});
    expect(after?.updatedAt.getTime()).toBe(before?.updatedAt.getTime());
  });

  it("doesn't let another user attach the owner's company to their own tender", async () => {
    const mine = await createCompany(owner, "Mine");
    const theirTender = await createTender(stranger);
    expect((await patch(stranger, theirTender.id, { companyId: mine.id })).status).toBe(404);
    expect((await storedRow(theirTender.id))?.companyId).not.toBe(mine.id);
  });

  it("stores clean value keys, NFC text, and markup as plain text", async () => {
    const tender = await createTender(owner);
    const nfd = "ऩ";
    const res = await patch(owner, tender.id, {
      values: {
        "  अधिकारी   का नाम ": `श्री ${nfd}`,
        "   ": "dropped",
        "": "dropped too",
        rate: "<script>alert(1)</script> {{officer}} 🙏",
      },
    });
    expect(res.status).toBe(200);
    const stored = (await storedRow(tender.id))?.values;
    expect(stored).toEqual({
      "अधिकारी का नाम": `श्री ${nfd.normalize("NFC")}`,
      rate: "<script>alert(1)</script> {{officer}} 🙏",
    });
  });

  it("replaces the whole values object, so a left-out key is removed", async () => {
    const tender = await createTender(owner);
    await patch(owner, tender.id, { values: { officer: "A", rate: "1" } });
    await patch(owner, tender.id, { values: { officer: "B" } });
    expect((await storedRow(tender.id))?.values).toEqual({ officer: "B" });
  });

  it("ignores a __proto__ key without polluting objects", async () => {
    const tender = await createTender(owner);
    const res = await tenderRoute.PATCH(
      apiRequest(owner, "/x", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: '{"values":{"__proto__":"x","officer":"A"}}',
      }),
      idParams(tender.id),
    );
    expect(res.status).toBe(200);
    expect(({} as Record<string, unknown>).officer).toBeUndefined();
    expect((await storedRow(tender.id))?.values.officer).toBe("A");
  });

  it("moves updatedAt forward on each later change", async () => {
    const tender = await createTender(owner);
    const first = (await (
      await patch(owner, tender.id, { values: { officer: "A" } })
    ).json()) as Tender;
    const second = (await (
      await patch(owner, tender.id, { values: { officer: "B" } })
    ).json()) as Tender;
    expect(new Date(second.updatedAt).getTime()).toBeGreaterThan(
      new Date(first.updatedAt).getTime(),
    );
  });

  it("still reads a tender whose chosen company and template were deleted", async () => {
    const company = await createCompany(owner, "Soon gone");
    const template = await createTemplate(owner, "Soon gone");
    const tender = await createTender(owner);
    await patch(owner, tender.id, { companyId: company.id, templateId: template.id });
    await companyRoute.DELETE(apiRequest(owner, "/x", { method: "DELETE" }), idParams(company.id));
    await templateRoute.DELETE(
      apiRequest(owner, "/x", { method: "DELETE" }),
      idParams(template.id),
    );
    const res = await read(owner, tender.id);
    expect(res.status).toBe(200);
    const after = (await res.json()) as Tender;
    expect(after.companyId).toBe(company.id);
    expect(after.templateId).toBe(template.id);
    expect((await patch(owner, tender.id, { values: { officer: "kept" } })).status).toBe(200);
  });

  it("skips deleted companies and templates when it picks the first for a new tender", async () => {
    const user = await createSignedInUser();
    try {
      const gone = await createCompany(user, "Gone");
      const kept = await createCompany(user, "Kept");
      const goneTemplate = await createTemplate(user, "Gone");
      const keptTemplate = await createTemplate(user, "Kept");
      await companyRoute.DELETE(apiRequest(user, "/x", { method: "DELETE" }), idParams(gone.id));
      await templateRoute.DELETE(
        apiRequest(user, "/x", { method: "DELETE" }),
        idParams(goneTemplate.id),
      );
      const tender = await createTender(user);
      expect(tender.companyId).toBe(kept.id);
      expect(tender.templateId).toBe(keptTemplate.id);
    } finally {
      await deleteUsers([user]);
    }
  });

  it("refuses a PATCH that isn't JSON or sets a field to the wrong type", async () => {
    const tender = await createTender(owner);
    const notJson = await tenderRoute.PATCH(
      apiRequest(owner, "/x", { method: "PATCH", body: "{oops" }),
      idParams(tender.id),
    );
    expect(notJson.status).toBe(400);
    expect((await patch(owner, tender.id, { values: null })).status).toBe(400);
    expect((await patch(owner, tender.id, { name: "x".repeat(201) })).status).toBe(400);
    expect((await patch(owner, tender.id, { companyId: "" })).status).toBe(400);
  });

  it("doesn't let the body change the type, owner or id of a tender", async () => {
    const tender = await createTender(owner);
    const res = await patch(owner, tender.id, {
      type: "notesheet",
      userId: stranger.id,
      id: MISSING_ID,
      name: "Same",
    });
    expect(res.status).toBe(200);
    const row = await storedRow(tender.id);
    expect(row?.type).toBe("quotation");
    expect(row?.userId).toBe(owner.id);
  });
});
