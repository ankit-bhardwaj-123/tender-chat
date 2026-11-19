import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as companyRoute from "@/app/api/companies/[id]/route";
import * as companiesRoute from "@/app/api/companies/route";
import { db } from "@/server/adapters/postgres";
import { company as companyTable } from "@/server/schema";
import type { Company } from "@/types";
import {
  apiRequest,
  createSignedInUser,
  deleteUsers,
  idParams,
  jsonBody,
  type TestUser,
} from "./users";

const MISSING_ID = "00000000-0000-4000-8000-000000000000";

let owner: TestUser;
let stranger: TestUser;

beforeAll(async () => {
  [owner, stranger] = await Promise.all([createSignedInUser(), createSignedInUser()]);
});

afterAll(async () => {
  await deleteUsers([owner, stranger]);
});

async function createCompany(name: string, fontKey?: string | null): Promise<Company> {
  const res = await companiesRoute.POST(
    apiRequest(owner, "/api/companies", jsonBody("POST", { name, fontKey })),
  );
  expect(res.status).toBe(201);
  return (await res.json()) as Company;
}

function patchCompany(as: TestUser | null, companyId: string, body: unknown): Promise<Response> {
  return companyRoute.PATCH(apiRequest(as, "/x", jsonBody("PATCH", body)), idParams(companyId));
}

async function storedFontKey(companyId: string): Promise<string | null | undefined> {
  const [row] = await db
    .select({ fontKey: companyTable.fontKey })
    .from(companyTable)
    .where(eq(companyTable.id, companyId));
  return row?.fontKey;
}

describe("company fonts", () => {
  it("stores the chosen font key in the database when a company is created with a font", async () => {
    const company = await createCompany("Mukta Co", "mukta");
    expect(company.fontKey).toBe("mukta");
    expect(await storedFontKey(company.id)).toBe("mukta");
  });

  it("shows the font in the company list when it is set", async () => {
    const company = await createCompany("Listed", "eczar");
    const res = await companiesRoute.GET(apiRequest(owner, "/api/companies"));
    const listed = ((await res.json()) as Company[]).find((c) => c.id === company.id);
    expect(listed?.fontKey).toBe("eczar");
  });

  it("reads a company made before fonts existed as having no font", async () => {
    const [row] = await db
      .insert(companyTable)
      .values({ userId: owner.id, name: "Old company" })
      .returning();
    const id = row?.id ?? "";
    const res = await companyRoute.GET(apiRequest(owner, "/x"), idParams(id));
    expect(res.status).toBe(200);
    expect(((await res.json()) as Company).fontKey).toBeNull();
  });

  it("answers 400 and keeps the stored font when a PATCH sends an unknown font", async () => {
    const company = await createCompany("Keep me", "laila");
    for (const fontKey of ["comic-sans", "", "Laila", 7, "../poppins"]) {
      const res = await patchCompany(owner, company.id, { name: "Changed", fontKey });
      expect(res.status).toBe(400);
    }
    const [row] = await db.select().from(companyTable).where(eq(companyTable.id, company.id));
    expect(row?.fontKey).toBe("laila");
    expect(row?.name).toBe("Keep me");
  });

  it("answers 400 when a create sends an empty or wrongly cased font", async () => {
    for (const fontKey of ["", "Mukta", " mukta"]) {
      const res = await companiesRoute.POST(
        apiRequest(owner, "/api/companies", jsonBody("POST", { name: "X", fontKey })),
      );
      expect(res.status).toBe(400);
    }
  });

  it("keeps the font when a PATCH changes only the name", async () => {
    const company = await createCompany("Rename only", "gotu");
    const res = await patchCompany(owner, company.id, { name: "Renamed" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Company;
    expect(body.name).toBe("Renamed");
    expect(body.fontKey).toBe("gotu");
    expect(await storedFontKey(company.id)).toBe("gotu");
  });

  it("clears the stored font to null when a PATCH sends null", async () => {
    const company = await createCompany("Clear me", "khand");
    const res = await patchCompany(owner, company.id, { name: "Clear me", fontKey: null });
    expect(((await res.json()) as Company).fontKey).toBeNull();
    expect(await storedFontKey(company.id)).toBeNull();
  });

  it("answers 404 when another user reads a company that has a font", async () => {
    const company = await createCompany("Private font", "yatra-one");
    const res = await companyRoute.GET(apiRequest(stranger, "/x"), idParams(company.id));
    expect(res.status).toBe(404);
    expect(JSON.stringify(await res.json())).not.toContain("yatra-one");
  });

  it("answers 404 and keeps the font when another user clears it with null", async () => {
    const company = await createCompany("Not yours", "mukta");
    const res = await patchCompany(stranger, company.id, { name: "Mine", fontKey: null });
    expect(res.status).toBe(404);
    expect(await storedFontKey(company.id)).toBe("mukta");
  });

  it("answers 404 when the font is set on a deleted or missing company", async () => {
    const company = await createCompany("Gone");
    await companyRoute.DELETE(apiRequest(owner, "/x", { method: "DELETE" }), idParams(company.id));
    const deleted = await patchCompany(owner, company.id, { name: "Gone", fontKey: "mukta" });
    expect(deleted.status).toBe(404);
    expect(await storedFontKey(company.id)).toBeNull();
    const missing = await patchCompany(owner, MISSING_ID, { name: "X", fontKey: "mukta" });
    expect(missing.status).toBe(404);
  });

  it("answers 401 when a signed-out request sets a font", async () => {
    const company = await createCompany("Signed out", "laila");
    const res = await patchCompany(null, company.id, { name: "X", fontKey: null });
    expect(res.status).toBe(401);
    expect(await storedFontKey(company.id)).toBe("laila");
  });
});
