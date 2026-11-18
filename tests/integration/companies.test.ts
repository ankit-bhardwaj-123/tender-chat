import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as fileRoute from "@/app/api/companies/[id]/files/[kind]/route";
import * as companyRoute from "@/app/api/companies/[id]/route";
import * as companiesRoute from "@/app/api/companies/route";
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

const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const PDF = new TextEncoder().encode("%PDF-1.4\nbody\n%%EOF");

let owner: TestUser;
let earlierFiles = new Set<string>();

beforeAll(async () => {
  owner = await createSignedInUser();
});

afterAll(async () => {
  await deleteUsers([owner]);
});

beforeEach(async () => {
  earlierFiles = new Set(await uploadedFiles(owner.id));
});

async function storedFiles(): Promise<string[]> {
  return (await uploadedFiles(owner.id)).filter((file) => !earlierFiles.has(file));
}

async function createCompany(name = "Shree Balaji"): Promise<Company> {
  const res = await companiesRoute.POST(
    apiRequest(owner, "/api/companies", jsonBody("POST", { name })),
  );
  expect(res.status).toBe(201);
  return (await res.json()) as Company;
}

function putFile(
  companyId: string,
  kind: CompanyFileKind,
  bytes: Uint8Array<ArrayBuffer>,
  name: string,
): Promise<Response> {
  const form = new FormData();
  form.append("file", new File([bytes], name));
  return fileRoute.PUT(
    apiRequest(owner, `/api/companies/${companyId}/files/${kind}`, { method: "PUT", body: form }),
    fileParams(companyId, kind),
  );
}

async function errorMessage(res: Response): Promise<string | undefined> {
  return ((await res.json()) as { error?: { message?: string } }).error?.message;
}

describe("companies API", () => {
  it("creates a company with a trimmed name and no files", async () => {
    const company = await createCompany("  Shree   Balaji ");
    expect(company.name).toBe("Shree Balaji");
    expect(company.files).toEqual({ letterhead: null, seal: null });
  });

  it("refuses an empty name", async () => {
    const res = await companiesRoute.POST(
      apiRequest(owner, "/api/companies", jsonBody("POST", { name: "  " })),
    );
    expect(res.status).toBe(400);
  });

  it("lists, reads and renames a company", async () => {
    const company = await createCompany("Old name");
    const path = `/api/companies/${company.id}`;

    const renamed = await companyRoute.PATCH(
      apiRequest(owner, path, jsonBody("PATCH", { name: "New name" })),
      idParams(company.id),
    );
    expect(renamed.status).toBe(200);
    expect(((await renamed.json()) as Company).name).toBe("New name");

    const read = await companyRoute.GET(apiRequest(owner, path), idParams(company.id));
    expect(((await read.json()) as Company).name).toBe("New name");

    const list = await companiesRoute.GET(apiRequest(owner, "/api/companies"));
    const names = ((await list.json()) as Company[]).map((c) => c.name);
    expect(names).toContain("New name");
  });

  it("marks a deleted company void and hides it from the list and from reads", async () => {
    const company = await createCompany("To delete");
    const path = `/api/companies/${company.id}`;

    const removed = await companyRoute.DELETE(
      apiRequest(owner, path, { method: "DELETE" }),
      idParams(company.id),
    );
    expect(removed.status).toBe(204);

    const list = await companiesRoute.GET(apiRequest(owner, "/api/companies"));
    expect(((await list.json()) as Company[]).some((c) => c.id === company.id)).toBe(false);
    const read = await companyRoute.GET(apiRequest(owner, path), idParams(company.id));
    expect(read.status).toBe(404);
    const again = await companyRoute.DELETE(
      apiRequest(owner, path, { method: "DELETE" }),
      idParams(company.id),
    );
    expect(again.status).toBe(404);
  });

  it("needs sign-in", async () => {
    expect((await companiesRoute.GET(apiRequest(null, "/api/companies"))).status).toBe(401);
  });
});

describe("company files", () => {
  it("stores a letterhead PDF and a seal JPG and serves them with their types", async () => {
    const company = await createCompany();

    const letterhead = await putFile(company.id, "letterhead", PDF, "letterhead.pdf");
    expect(letterhead.status).toBe(200);
    const seal = await putFile(company.id, "seal", JPG, "seal.jpg");
    expect(seal.status).toBe(200);
    expect(((await seal.json()) as Company).files).toMatchObject({
      letterhead: { fileName: "letterhead.pdf", size: PDF.length },
      seal: { fileName: "seal.jpg", size: JPG.length },
    });

    const served = await fileRoute.GET(apiRequest(owner, "/x"), fileParams(company.id, "seal"));
    expect(served.status).toBe(200);
    expect(served.headers.get("content-type")).toBe("image/jpeg");
    expect(served.headers.get("cache-control")).toBe("private, no-store");
    expect(new Uint8Array(await served.arrayBuffer())).toEqual(JPG);

    const pdf = await fileRoute.GET(apiRequest(owner, "/x"), fileParams(company.id, "letterhead"));
    expect(pdf.headers.get("content-type")).toBe("application/pdf");
    expect(await storedFiles()).toHaveLength(2);
  });

  it("replaces a file and removes the old stored file", async () => {
    const company = await createCompany();
    await putFile(company.id, "seal", JPG, "first.jpg");
    const [firstKey] = await storedFiles();

    const res = await putFile(company.id, "seal", JPG, "second.jpg");
    expect(res.status).toBe(200);
    expect(((await res.json()) as Company).files.seal?.fileName).toBe("second.jpg");
    const after = await storedFiles();
    expect(after).toHaveLength(1);
    expect(after[0]).not.toBe(firstKey);
  });

  it("refuses the wrong type with the right message and keeps nothing", async () => {
    const company = await createCompany();

    const jpgAsLetterhead = await putFile(company.id, "letterhead", JPG, "lh.pdf");
    expect(jpgAsLetterhead.status).toBe(400);
    expect(await errorMessage(jpgAsLetterhead)).toBe("Letterhead must be a PDF.");

    const pdfAsSeal = await putFile(company.id, "seal", PDF, "seal.jpg");
    expect(pdfAsSeal.status).toBe(400);
    expect(await errorMessage(pdfAsSeal)).toBe("Seal must be a JPG.");

    expect(await storedFiles()).toEqual([]);
  });

  it("refuses an empty file and a file over 10 MB", async () => {
    const company = await createCompany();

    const empty = await putFile(company.id, "seal", new Uint8Array(), "seal.jpg");
    expect(empty.status).toBe(400);
    expect(await errorMessage(empty)).toBe("The file is empty.");

    const big = new Uint8Array(10 * 1024 * 1024 + 1);
    big.set(JPG);
    const tooBig = await putFile(company.id, "seal", big, "seal.jpg");
    expect(tooBig.status).toBe(400);
    expect(await errorMessage(tooBig)).toBe("A file must be at most 10 MB.");

    expect(await storedFiles()).toEqual([]);
  });

  it("removes a file and its stored copy", async () => {
    const company = await createCompany();
    await putFile(company.id, "letterhead", PDF, "letterhead.pdf");

    const res = await fileRoute.DELETE(
      apiRequest(owner, "/x", { method: "DELETE" }),
      fileParams(company.id, "letterhead"),
    );
    expect(res.status).toBe(200);
    expect(((await res.json()) as Company).files.letterhead).toBeNull();
    expect(await storedFiles()).toEqual([]);

    const again = await fileRoute.GET(
      apiRequest(owner, "/x"),
      fileParams(company.id, "letterhead"),
    );
    expect(again.status).toBe(404);
  });

  it("answers 404 for an unknown file kind", async () => {
    const company = await createCompany();
    const res = await fileRoute.GET(apiRequest(owner, "/x"), fileParams(company.id, "signature"));
    expect(res.status).toBe(404);
  });
});
