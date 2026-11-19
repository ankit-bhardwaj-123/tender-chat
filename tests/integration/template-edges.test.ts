import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as companyFileRoute from "@/app/api/companies/[id]/files/[kind]/route";
import * as companiesRoute from "@/app/api/companies/route";
import * as fileRoute from "@/app/api/templates/[id]/file/route";
import * as templateRoute from "@/app/api/templates/[id]/route";
import * as templatesRoute from "@/app/api/templates/route";
import { storage } from "@/server/adapters/file-storage";
import { db } from "@/server/adapters/postgres";
import { template as templateTable } from "@/server/schema";
import type { Company, Template } from "@/types";
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

const HTML = "<p>{{officer}}</p>";

let owner: TestUser;
let other: TestUser;

beforeAll(async () => {
  [owner, other] = await Promise.all([createSignedInUser(), createSignedInUser()]);
});

afterAll(async () => {
  await deleteUsers([owner, other]);
});

function postForm(as: TestUser, name: string, content: BlobPart, fileName: string) {
  const form = new FormData();
  form.append("name", name);
  form.append("language", "hi");
  form.append("file", new File([content], fileName));
  return templatesRoute.POST(apiRequest(as, "/api/templates", { method: "POST", body: form }));
}

async function createTemplate(as: TestUser, name: string, content: BlobPart = HTML) {
  const res = await postForm(as, name, content, "quote.html");
  expect(res.status).toBe(201);
  return (await res.json()) as Template;
}

function postRef(as: TestUser, key: string, fileName: string) {
  return templatesRoute.POST(
    apiRequest(
      as,
      "/api/templates",
      jsonBody("POST", { name: "From blob", language: "en", file: { key, fileName } }),
    ),
  );
}

function patch(as: TestUser, templateId: string, init: RequestInit) {
  return templateRoute.PATCH(
    apiRequest(as, `/api/templates/${templateId}`, init),
    idParams(templateId),
  );
}

function putFile(as: TestUser, templateId: string, content: BlobPart, fileName: string) {
  const form = new FormData();
  form.append("file", new File([content], fileName));
  return fileRoute.PUT(
    apiRequest(as, `/api/templates/${templateId}/file`, { method: "PUT", body: form }),
    idParams(templateId),
  );
}

function remove(as: TestUser, templateId: string) {
  return templateRoute.DELETE(
    apiRequest(as, `/api/templates/${templateId}`, { method: "DELETE" }),
    idParams(templateId),
  );
}

async function storedRow(templateId: string) {
  const [row] = await db.select().from(templateTable).where(eq(templateTable.id, templateId));
  return row;
}

describe("template edits", () => {
  it("refuses a bad edit body and leaves the template as it was", async () => {
    const created = await createTemplate(owner, "Keep me");
    const notJson = await patch(owner, created.id, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "{",
    });
    const blank = await patch(owner, created.id, jsonBody("PATCH", { name: "   " }));
    const french = await patch(owner, created.id, jsonBody("PATCH", { language: "fr" }));
    expect([notJson.status, blank.status, french.status]).toEqual([400, 400, 400]);
    const row = await storedRow(created.id);
    expect([row?.name, row?.language]).toEqual(["Keep me", "hi"]);
  });

  it("saves a name with markup and braces as plain text", async () => {
    const created = await createTemplate(owner, "<script>alert(1)</script> {{x}}");
    expect(created.name).toBe("<script>alert(1)</script> {{x}}");
  });

  it("lists only active templates, oldest first", async () => {
    const first = await createTemplate(other, "First");
    const second = await createTemplate(other, "Second");
    const gone = await createTemplate(other, "Gone");
    expect((await remove(other, gone.id)).status).toBe(204);
    const list = (await (
      await templatesRoute.GET(apiRequest(other, "/api/templates"))
    ).json()) as Template[];
    expect(list.map((item) => item.id)).toEqual([first.id, second.id]);
  });
});

describe("deleted templates", () => {
  it("keeps the row as void and answers 404 for every later action", async () => {
    const created = await createTemplate(owner, "Delete twice");
    const before = await uploadedFiles(owner.id);
    expect((await remove(owner, created.id)).status).toBe(204);
    expect((await storedRow(created.id))?.status).toBe("void");

    const again = await remove(owner, created.id);
    const edit = await patch(owner, created.id, jsonBody("PATCH", { name: "Back" }));
    const replace = await putFile(owner, created.id, "<p>{{new}}</p>", "new.html");
    expect([again.status, edit.status, replace.status]).toEqual([404, 404, 404]);
    expect(await uploadedFiles(owner.id)).toEqual(before);
  });
});

describe("template file names and keys", () => {
  it("builds the storage key itself and strips path parts from the file name", async () => {
    const res = await postForm(owner, "Path", HTML, "..\\..\\evil/../quote.HTML");
    expect(res.status).toBe(201);
    const created = (await res.json()) as Template;
    expect(created.fileName).not.toMatch(/[\\/]/);
    const row = await storedRow(created.id);
    expect(row?.storageKey).toMatch(new RegExp(`^uploads/${owner.id}/[0-9a-f-]{36}\\.html$`));
  });

  it("accepts a UTF-8 file that starts with a byte order mark", async () => {
    const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
    const created = await createTemplate(owner, "BOM", new Blob([bom, "<p>{{दर}}</p>"]));
    expect(created.placeholders).toEqual(["दर"]);
  });

  it("keeps the HTML as uploaded when it holds a script, and serves it sandboxed", async () => {
    const html = "<p>{{officer}}</p><script>document.title='x'</script>";
    const created = await createTemplate(owner, "Script", html);
    const res = await fileRoute.GET(apiRequest(owner, "/x"), idParams(created.id));
    expect(res.headers.get("content-security-policy")?.split("; ")).toContain("sandbox");
    expect(await res.text()).toBe(html);
  });
});

describe("template uploads sent as stored keys", () => {
  it("refuses another user's stored file and leaves it in place", async () => {
    const theirs = await createTemplate(other, "Theirs");
    const [theirFile] = await uploadedFiles(other.id);
    const key = `uploads/${other.id}/${theirFile}`;
    const res = await postRef(owner, key, "taken.html");
    expect(res.status).toBe(400);
    expect(await uploadedFiles(other.id)).toContain(theirFile);
    const open = await fileRoute.GET(apiRequest(other, "/x"), idParams(theirs.id));
    expect(await open.text()).toBe(HTML);
  });

  it("refuses a key that is already saved on a template", async () => {
    const created = await createTemplate(owner, "Saved key");
    const row = await storedRow(created.id);
    const res = await postRef(owner, row?.storageKey ?? "", "again.html");
    expect(res.status).toBe(400);
    const open = await fileRoute.GET(apiRequest(owner, "/x"), idParams(created.id));
    expect(await open.text()).toBe(HTML);
  });

  it("refuses a stored key that was not uploaded as an HTML file", async () => {
    const key = `uploads/${owner.id}/${randomUUID()}.pdf`;
    await storage.save(key, new Blob([HTML]));
    const res = await postRef(owner, key, "quote.html");
    expect(res.status).toBe(400);
  });
});

describe("other users and templates", () => {
  it("keeps no file when someone replaces another user's template", async () => {
    const theirs = await createTemplate(other, "Not yours");
    const before = await uploadedFiles(owner.id);
    const res = await putFile(owner, theirs.id, "<p>{{taken}}</p>", "taken.html");
    expect(res.status).toBe(404);
    expect(await uploadedFiles(owner.id)).toEqual(before);
  });
});

describe("company files after the upload kinds change", () => {
  it("still refuses an HTML file as a letterhead", async () => {
    const created = await companiesRoute.POST(
      apiRequest(owner, "/api/companies", jsonBody("POST", { name: "Kinds Co" })),
    );
    const company = (await created.json()) as Company;
    const form = new FormData();
    form.append("file", new File([HTML], "letterhead.html"));
    const res = await companyFileRoute.PUT(
      apiRequest(owner, "/x", { method: "PUT", body: form }),
      fileParams(company.id, "letterhead"),
    );
    expect(res.status).toBe(400);
  });

  it("still accepts a PDF letterhead larger than the 2 MB template limit", async () => {
    const created = await companiesRoute.POST(
      apiRequest(owner, "/api/companies", jsonBody("POST", { name: "Big letterhead Co" })),
    );
    const company = (await created.json()) as Company;
    const pdf = new Uint8Array(3 * 1024 * 1024).fill(0x20);
    pdf.set(new TextEncoder().encode("%PDF-1.4\n"));
    const form = new FormData();
    form.append("file", new File([pdf], "letterhead.pdf"));
    const res = await companyFileRoute.PUT(
      apiRequest(owner, "/x", { method: "PUT", body: form }),
      fileParams(company.id, "letterhead"),
    );
    expect(res.status).toBe(200);
  });
});
