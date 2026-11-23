import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as tenderRoute from "@/app/api/tenders/[id]/route";
import * as tendersRoute from "@/app/api/tenders/route";
import type { CreatedTender, Tender } from "@/types";
import {
  apiRequest,
  createSignedInUser,
  deleteUsers,
  idParams,
  jsonBody,
  type TestUser,
} from "./users";

let owner: TestUser;

beforeAll(async () => {
  owner = await createSignedInUser();
});

afterAll(async () => {
  await deleteUsers([owner]);
});

async function createTender(name?: string): Promise<Tender> {
  const res = await tendersRoute.POST(
    apiRequest(owner, "/api/tenders", jsonBody("POST", { name })),
  );
  expect(res.status).toBe(201);
  return ((await res.json()) as CreatedTender).tender;
}

async function listTenders(search = ""): Promise<Tender[]> {
  const path = search ? `/api/tenders?search=${encodeURIComponent(search)}` : "/api/tenders";
  const res = await tendersRoute.GET(apiRequest(owner, path));
  expect(res.status).toBe(200);
  return (await res.json()) as Tender[];
}

describe("tenders API", () => {
  it("names a tender “Untitled tender” when no name is given", async () => {
    const tender = await createTender();
    expect(tender.name).toBe("Untitled tender");
  });

  it("cleans the name it is given", async () => {
    const tender = await createTender("  Road   works  ");
    expect(tender.name).toBe("Road works");
  });

  it("lists newest first and searches by name", async () => {
    const older = await createTender("पुल निर्माण bridge");
    const newer = await createTender("Hospital 50% EMD");

    const ids = (await listTenders()).map((t) => t.id);
    expect(ids.indexOf(newer.id)).toBeLessThan(ids.indexOf(older.id));

    const found = await listTenders("पुल");
    expect(found.map((t) => t.id)).toEqual([older.id]);

    const percent = await listTenders("50%");
    expect(percent.map((t) => t.id)).toEqual([newer.id]);
  });

  it("reads one tender", async () => {
    const tender = await createTender("Read me");
    const res = await tenderRoute.GET(
      apiRequest(owner, `/api/tenders/${tender.id}`),
      idParams(tender.id),
    );
    expect(res.status).toBe(200);
    expect(((await res.json()) as Tender).name).toBe("Read me");
  });

  it("renames a tender and rejects an empty name", async () => {
    const tender = await createTender("Old name");
    const renamed = await tenderRoute.PATCH(
      apiRequest(owner, `/api/tenders/${tender.id}`, jsonBody("PATCH", { name: "New name" })),
      idParams(tender.id),
    );
    expect(renamed.status).toBe(200);
    expect(((await renamed.json()) as Tender).name).toBe("New name");

    const empty = await tenderRoute.PATCH(
      apiRequest(owner, `/api/tenders/${tender.id}`, jsonBody("PATCH", { name: "   " })),
      idParams(tender.id),
    );
    expect(empty.status).toBe(400);
  });

  it("deletes a tender", async () => {
    const tender = await createTender("Delete me");
    const res = await tenderRoute.DELETE(
      apiRequest(owner, `/api/tenders/${tender.id}`, { method: "DELETE" }),
      idParams(tender.id),
    );
    expect(res.status).toBe(204);

    const again = await tenderRoute.GET(
      apiRequest(owner, `/api/tenders/${tender.id}`),
      idParams(tender.id),
    );
    expect(again.status).toBe(404);
  });
});
