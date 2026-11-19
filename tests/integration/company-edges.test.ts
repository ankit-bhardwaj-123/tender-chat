import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as fileRoute from "@/app/api/companies/[id]/files/[kind]/route";
import * as companyRoute from "@/app/api/companies/[id]/route";
import * as companiesRoute from "@/app/api/companies/route";
import * as tokenRoute from "@/app/api/uploads/token/route";
import { db } from "@/server/adapters/postgres";
import { company as companyTable, companyFile } from "@/server/schema";
import type { Company, CompanyFileKind } from "@/types";
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

const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 9, 9, 9]);
const PDF = new TextEncoder().encode("%PDF-1.7\nx\n%%EOF");
const MALFORMED_ID = "not-a-uuid";
const MISSING_ID = "00000000-0000-4000-8000-000000000000";

let owner: TestUser;
let stranger: TestUser;

beforeAll(async () => {
  [owner, stranger] = await Promise.all([createSignedInUser(), createSignedInUser()]);
});

afterAll(async () => {
  await deleteUsers([owner, stranger]);
});

async function createCompany(name: string): Promise<Company> {
  const res = await companiesRoute.POST(
    apiRequest(owner, "/api/companies", jsonBody("POST", { name })),
  );
  expect(res.status).toBe(201);
  return (await res.json()) as Company;
}

function putFile(
  as: TestUser,
  companyId: string,
  kind: CompanyFileKind,
  file: File,
): Promise<Response> {
  const form = new FormData();
  form.append("file", file);
  return fileRoute.PUT(
    apiRequest(as, "/x", { method: "PUT", body: form }),
    fileParams(companyId, kind),
  );
}

function putRef(companyId: string, kind: CompanyFileKind, key: string): Promise<Response> {
  return fileRoute.PUT(
    apiRequest(owner, "/x", jsonBody("PUT", { file: { key, fileName: "x.pdf" } })),
    fileParams(companyId, kind),
  );
}

async function errorMessage(res: Response): Promise<string | undefined> {
  return ((await res.json()) as { error?: { message?: string } }).error?.message;
}

describe("company routes when signed out", () => {
  it("answers 401 on every company and upload route when there is no session", async () => {
    const id = MISSING_ID;
    const form = new FormData();
    form.append("file", new File([JPG], "seal.jpg"));
    const responses = await Promise.all([
      companiesRoute.POST(apiRequest(null, "/x", jsonBody("POST", { name: "X" }))),
      companyRoute.GET(apiRequest(null, "/x"), idParams(id)),
      companyRoute.PATCH(apiRequest(null, "/x", jsonBody("PATCH", { name: "X" })), idParams(id)),
      companyRoute.DELETE(apiRequest(null, "/x", { method: "DELETE" }), idParams(id)),
      fileRoute.PUT(apiRequest(null, "/x", { method: "PUT", body: form }), fileParams(id, "seal")),
      fileRoute.DELETE(apiRequest(null, "/x", { method: "DELETE" }), fileParams(id, "seal")),
      tokenRoute.POST(apiRequest(null, "/x", jsonBody("POST", {}))),
    ]);
    expect(responses.map((res) => res.status)).toEqual([401, 401, 401, 401, 401, 401, 401]);
  });
});

describe("company routes with bad ids and bodies", () => {
  it("answers 404 Company not found when the id is malformed", async () => {
    const responses = await Promise.all([
      companyRoute.GET(apiRequest(owner, "/x"), idParams(MALFORMED_ID)),
      companyRoute.PATCH(
        apiRequest(owner, "/x", jsonBody("PATCH", { name: "X" })),
        idParams(MALFORMED_ID),
      ),
      companyRoute.DELETE(apiRequest(owner, "/x", { method: "DELETE" }), idParams(MALFORMED_ID)),
      fileRoute.GET(apiRequest(owner, "/x"), fileParams(MALFORMED_ID, "seal")),
      fileRoute.DELETE(
        apiRequest(owner, "/x", { method: "DELETE" }),
        fileParams(MALFORMED_ID, "seal"),
      ),
    ]);
    expect(responses.map((res) => res.status)).toEqual([404, 404, 404, 404, 404]);
    expect(await errorMessage(responses[0] as Response)).toBe("Company not found.");
  });

  it("answers 404 when the company id does not exist", async () => {
    const res = await companyRoute.GET(apiRequest(owner, "/x"), idParams(MISSING_ID));
    expect(res.status).toBe(404);
    expect(await errorMessage(res)).toBe("Company not found.");
  });

  it("answers 400 and changes nothing when the body is not JSON or the name is bad", async () => {
    const company = await createCompany("Keep me");
    const notJson = await companiesRoute.POST(
      apiRequest(owner, "/x", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{oops",
      }),
    );
    const tooLong = await companyRoute.PATCH(
      apiRequest(owner, "/x", jsonBody("PATCH", { name: "a".repeat(201) })),
      idParams(company.id),
    );
    const blank = await companyRoute.PATCH(
      apiRequest(owner, "/x", jsonBody("PATCH", { name: "   " })),
      idParams(company.id),
    );
    expect([notJson.status, tooLong.status, blank.status]).toEqual([400, 400, 400]);

    const [row] = await db.select().from(companyTable).where(eq(companyTable.id, company.id));
    expect(row?.name).toBe("Keep me");
  });

  it("answers 400 when the upload form has no file", async () => {
    const company = await createCompany("No file");
    const form = new FormData();
    form.append("other", "text");
    const res = await fileRoute.PUT(
      apiRequest(owner, "/x", { method: "PUT", body: form }),
      fileParams(company.id, "seal"),
    );
    expect(res.status).toBe(400);
    expect(await errorMessage(res)).toBe("The form has no file.");
  });
});

describe("company list and delete in the database", () => {
  it("lists companies oldest first", async () => {
    const lister = await createSignedInUser();
    try {
      for (const name of ["First", "Second", "Third"]) {
        await companiesRoute.POST(apiRequest(lister, "/x", jsonBody("POST", { name })));
      }
      const res = await companiesRoute.GET(apiRequest(lister, "/api/companies"));
      expect(((await res.json()) as Company[]).map((c) => c.name)).toEqual([
        "First",
        "Second",
        "Third",
      ]);
    } finally {
      await deleteUsers([lister]);
    }
  });

  it("answers 404 when another user sets a company's font and leaves the font as it was", async () => {
    const company = await createCompany("Font owner");
    const res = await companyRoute.PATCH(
      apiRequest(stranger, "/x", jsonBody("PATCH", { name: "Taken", fontKey: "gotu" })),
      idParams(company.id),
    );
    expect(res.status).toBe(404);
    const [row] = await db.select().from(companyTable).where(eq(companyTable.id, company.id));
    expect(row?.fontKey).toBeNull();
    expect(row?.name).toBe("Font owner");
  });

  it("reads a font key that is no longer on the list as null", async () => {
    const company = await createCompany("Old font");
    await db
      .update(companyTable)
      .set({ fontKey: "kruti-dev" })
      .where(eq(companyTable.id, company.id));
    const res = await companyRoute.GET(apiRequest(owner, "/x"), idParams(company.id));
    expect(((await res.json()) as Company).fontKey).toBeNull();
  });

  it("keeps the row with status void and its files when a company is deleted", async () => {
    const company = await createCompany("Voided");
    await putFile(owner, company.id, "seal", new File([JPG], "seal.jpg"));
    await companyRoute.DELETE(apiRequest(owner, "/x", { method: "DELETE" }), idParams(company.id));

    const [row] = await db.select().from(companyTable).where(eq(companyTable.id, company.id));
    expect(row?.status).toBe("void");
    const files = await db.select().from(companyFile).where(eq(companyFile.companyId, company.id));
    expect(files).toHaveLength(1);
  });

  it("answers 404 for every file route and rename once the company is deleted", async () => {
    const company = await createCompany("Gone");
    await putFile(owner, company.id, "seal", new File([JPG], "seal.jpg"));
    await companyRoute.DELETE(apiRequest(owner, "/x", { method: "DELETE" }), idParams(company.id));
    const before = await uploadedFiles(owner.id);

    const open = await fileRoute.GET(apiRequest(owner, "/x"), fileParams(company.id, "seal"));
    const upload = await putFile(owner, company.id, "letterhead", new File([PDF], "lh.pdf"));
    const remove = await fileRoute.DELETE(
      apiRequest(owner, "/x", { method: "DELETE" }),
      fileParams(company.id, "seal"),
    );
    const rename = await companyRoute.PATCH(
      apiRequest(owner, "/x", jsonBody("PATCH", { name: "Back" })),
      idParams(company.id),
    );
    expect([open.status, upload.status, remove.status, rename.status]).toEqual([
      404, 404, 404, 404,
    ]);
    expect((await uploadedFiles(owner.id)).sort()).toEqual(before.sort());
  });
});

describe("company file checks", () => {
  it("accepts a file of exactly 10 MB", async () => {
    const company = await createCompany("Ten MB");
    const bytes = new Uint8Array(10 * 1024 * 1024);
    bytes.set(PDF);
    const res = await putFile(owner, company.id, "letterhead", new File([bytes], "big.pdf"));
    expect(res.status).toBe(200);
    expect(((await res.json()) as Company).files.letterhead?.size).toBe(10 * 1024 * 1024);
  });

  it("judges the file by its bytes, not its name or MIME type", async () => {
    const company = await createCompany("By bytes");
    const pdfNamedJpg = new File([PDF], "looks-like.jpg", { type: "image/jpeg" });
    const res = await putFile(owner, company.id, "letterhead", pdfNamedJpg);
    expect(res.status).toBe(200);
    const served = await fileRoute.GET(
      apiRequest(owner, "/x"),
      fileParams(company.id, "letterhead"),
    );
    expect(served.headers.get("content-type")).toBe("application/pdf");
    expect(served.headers.get("x-content-type-options")).toBe("nosniff");

    const htmlNamedPdf = new File(["<html><script>alert(1)</script>"], "x.pdf", {
      type: "application/pdf",
    });
    const refused = await putFile(owner, company.id, "letterhead", htmlNamedPdf);
    expect(refused.status).toBe(400);
    expect(await errorMessage(refused)).toBe("Letterhead must be a PDF.");
  });

  it("keeps the old file when a replacement has the wrong type", async () => {
    const company = await createCompany("Keep old");
    await putFile(owner, company.id, "seal", new File([JPG], "good.jpg"));
    const bad = await putFile(owner, company.id, "seal", new File([PDF], "bad.jpg"));
    expect(bad.status).toBe(400);

    const read = await companyRoute.GET(apiRequest(owner, "/x"), idParams(company.id));
    expect(((await read.json()) as Company).files.seal?.fileName).toBe("good.jpg");
    const served = await fileRoute.GET(apiRequest(owner, "/x"), fileParams(company.id, "seal"));
    expect(new Uint8Array(await served.arrayBuffer())).toEqual(JPG);
  });

  it("stores a Hindi file name, strips slashes and control characters, and keeps user text out of the key", async () => {
    const company = await createCompany("Names");
    const res = await putFile(
      owner,
      company.id,
      "seal",
      new File([JPG], "मुहर/..\\\u0007 सील.jpg"),
    );
    expect(res.status).toBe(200);
    expect(((await res.json()) as Company).files.seal?.fileName).toBe("मुहर.. सील.jpg");

    const [row] = await db.select().from(companyFile).where(eq(companyFile.companyId, company.id));
    expect(row?.storageKey).toMatch(new RegExp(`^uploads/${owner.id}/[0-9a-f-]{36}\\.jpg$`));

    const served = await fileRoute.GET(apiRequest(owner, "/x"), fileParams(company.id, "seal"));
    const disposition = served.headers.get("content-disposition") ?? "";
    expect(disposition.startsWith("inline; filename*=UTF-8''")).toBe(true);
    expect(decodeURIComponent(disposition.split("''")[1] ?? "")).toBe("मुहर.. सील.jpg");
  });

  it("keeps exactly one stored file when two first uploads of the same kind arrive together", async () => {
    const company = await createCompany("Race");
    const before = new Set(await uploadedFiles(owner.id));
    const results = await Promise.all([
      putFile(owner, company.id, "seal", new File([JPG], "one.jpg")),
      putFile(owner, company.id, "seal", new File([JPG], "two.jpg")),
    ]);
    expect(results.map((res) => res.status)).toEqual([200, 200]);
    const added = (await uploadedFiles(owner.id)).filter((file) => !before.has(file));
    expect(added).toHaveLength(1);
  });

  it("answers 404 File not found when removing a file that was never uploaded", async () => {
    const company = await createCompany("Nothing to remove");
    const res = await fileRoute.DELETE(
      apiRequest(owner, "/x", { method: "DELETE" }),
      fileParams(company.id, "letterhead"),
    );
    expect(res.status).toBe(404);
    expect(await errorMessage(res)).toBe("File not found.");
  });

  it("answers 404 for an unknown kind on upload and remove", async () => {
    const company = await createCompany("Kinds");
    const upload = await fileRoute.PUT(
      apiRequest(owner, "/x", { method: "PUT", body: new FormData() }),
      fileParams(company.id, "signature"),
    );
    const remove = await fileRoute.DELETE(
      apiRequest(owner, "/x", { method: "DELETE" }),
      fileParams(company.id, "__proto__"),
    );
    expect([upload.status, remove.status]).toEqual([404, 404]);
  });
});

describe("blob references and other users", () => {
  it("refuses a Blob reference to another user's key, a traversal key or a missing file", async () => {
    const company = await createCompany("Refs");
    const fileId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    const foreign = await putRef(company.id, "letterhead", `uploads/${stranger.id}/${fileId}.pdf`);
    const traversal = await putRef(
      company.id,
      "letterhead",
      `uploads/${owner.id}/../${stranger.id}/${fileId}.pdf`,
    );
    const missing = await putRef(company.id, "letterhead", `uploads/${owner.id}/${fileId}.pdf`);
    expect([foreign.status, traversal.status, missing.status]).toEqual([400, 400, 400]);
    expect(await errorMessage(foreign)).toBe("Upload the file first.");
    expect(await errorMessage(missing)).toBe("Upload the file first.");
  });

  it("leaves no stored file behind when another user uploads to someone else's company", async () => {
    const company = await createCompany("Not yours");
    const res = await putFile(stranger, company.id, "seal", new File([JPG], "seal.jpg"));
    expect(res.status).toBe(404);
    expect(await errorMessage(res)).toBe("Company not found.");
    expect(await uploadedFiles(stranger.id)).toEqual([]);
  });

  it("answers 404 from the upload token route when Blob uploads are off", async () => {
    const res = await tokenRoute.POST(
      apiRequest(owner, "/x", jsonBody("POST", { type: "blob.generate-client-token" })),
    );
    expect(res.status).toBe(404);
  });
});
