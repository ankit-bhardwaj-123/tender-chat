import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as fileRoute from "@/app/api/companies/[id]/files/[kind]/route";
import * as companyRoute from "@/app/api/companies/[id]/route";
import * as companiesRoute from "@/app/api/companies/route";
import * as tenderRoute from "@/app/api/tenders/[id]/route";
import * as tendersRoute from "@/app/api/tenders/route";
import type { Company, Tender } from "@/types";
import {
  apiRequest,
  createSignedInUser,
  deleteUsers,
  fileParams,
  idParams,
  jsonBody,
  type TestUser,
} from "./users";

let userA: TestUser;
let userB: TestUser;
let tenderOfA: Tender;
let companyOfA: Company;

beforeAll(async () => {
  [userA, userB] = await Promise.all([createSignedInUser(), createSignedInUser()]);
  const res = await tendersRoute.POST(
    apiRequest(userA, "/api/tenders", jsonBody("POST", { name: "A's private tender" })),
  );
  tenderOfA = (await res.json()) as Tender;
  const created = await companiesRoute.POST(
    apiRequest(userA, "/api/companies", jsonBody("POST", { name: "A's private company" })),
  );
  companyOfA = (await created.json()) as Company;
  const form = new FormData();
  form.append("file", new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1])], "seal.jpg"));
  await fileRoute.PUT(
    apiRequest(userA, "/x", { method: "PUT", body: form }),
    fileParams(companyOfA.id, "seal"),
  );
});

afterAll(async () => {
  await deleteUsers([userA, userB]);
});

describe("one user can't reach another user's tenders", () => {
  it("doesn't list A's tender for B, even when B searches for it", async () => {
    const res = await tendersRoute.GET(apiRequest(userB, "/api/tenders?search=private"));
    expect(res.status).toBe(200);
    expect((await res.json()) as Tender[]).toEqual([]);
  });

  it("answers 404 when B reads, renames or deletes A's tender", async () => {
    const path = `/api/tenders/${tenderOfA.id}`;
    const read = await tenderRoute.GET(apiRequest(userB, path), idParams(tenderOfA.id));
    const rename = await tenderRoute.PATCH(
      apiRequest(userB, path, jsonBody("PATCH", { name: "Taken" })),
      idParams(tenderOfA.id),
    );
    const remove = await tenderRoute.DELETE(
      apiRequest(userB, path, { method: "DELETE" }),
      idParams(tenderOfA.id),
    );
    expect([read.status, rename.status, remove.status]).toEqual([404, 404, 404]);

    const stillThere = await tenderRoute.GET(apiRequest(userA, path), idParams(tenderOfA.id));
    expect(((await stillThere.json()) as Tender).name).toBe("A's private tender");
  });

  it("answers 401 with no login", async () => {
    const list = await tendersRoute.GET(apiRequest(null, "/api/tenders"));
    const read = await tenderRoute.GET(
      apiRequest(null, `/api/tenders/${tenderOfA.id}`),
      idParams(tenderOfA.id),
    );
    expect([list.status, read.status]).toEqual([401, 401]);
  });

  it("answers 404 for an id that isn't a uuid", async () => {
    const res = await tenderRoute.GET(apiRequest(userA, "/api/tenders/nope"), idParams("nope"));
    expect(res.status).toBe(404);
  });
});

describe("one user can't reach another user's companies", () => {
  it("doesn't list A's company for B", async () => {
    const res = await companiesRoute.GET(apiRequest(userB, "/api/companies"));
    expect(res.status).toBe(200);
    expect((await res.json()) as Company[]).toEqual([]);
  });

  it("answers 404 when B reads, renames or deletes A's company", async () => {
    const path = `/api/companies/${companyOfA.id}`;
    const read = await companyRoute.GET(apiRequest(userB, path), idParams(companyOfA.id));
    const rename = await companyRoute.PATCH(
      apiRequest(userB, path, jsonBody("PATCH", { name: "Taken" })),
      idParams(companyOfA.id),
    );
    const remove = await companyRoute.DELETE(
      apiRequest(userB, path, { method: "DELETE" }),
      idParams(companyOfA.id),
    );
    expect([read.status, rename.status, remove.status]).toEqual([404, 404, 404]);

    const stillThere = await companyRoute.GET(apiRequest(userA, path), idParams(companyOfA.id));
    expect(((await stillThere.json()) as Company).name).toBe("A's private company");
  });

  it("answers 404 when B opens, replaces or removes A's company files", async () => {
    const form = new FormData();
    form.append("file", new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 2])], "x.jpg"));
    const open = await fileRoute.GET(apiRequest(userB, "/x"), fileParams(companyOfA.id, "seal"));
    const replace = await fileRoute.PUT(
      apiRequest(userB, "/x", { method: "PUT", body: form }),
      fileParams(companyOfA.id, "seal"),
    );
    const remove = await fileRoute.DELETE(
      apiRequest(userB, "/x", { method: "DELETE" }),
      fileParams(companyOfA.id, "seal"),
    );
    expect([open.status, replace.status, remove.status]).toEqual([404, 404, 404]);

    const own = await fileRoute.GET(apiRequest(userA, "/x"), fileParams(companyOfA.id, "seal"));
    expect(own.status).toBe(200);
  });

  it("answers 401 with no login", async () => {
    const res = await fileRoute.GET(apiRequest(null, "/x"), fileParams(companyOfA.id, "seal"));
    expect(res.status).toBe(401);
  });
});
