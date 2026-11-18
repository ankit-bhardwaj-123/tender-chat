import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as tenderRoute from "@/app/api/tenders/[id]/route";
import * as tendersRoute from "@/app/api/tenders/route";
import type { Tender } from "@/types";
import {
  apiRequest,
  createSignedInUser,
  deleteUsers,
  idParams,
  jsonBody,
  type TestUser,
} from "./users";

let userA: TestUser;
let userB: TestUser;
let tenderOfA: Tender;

beforeAll(async () => {
  [userA, userB] = await Promise.all([createSignedInUser(), createSignedInUser()]);
  const res = await tendersRoute.POST(
    apiRequest(userA, "/api/tenders", jsonBody("POST", { name: "A's private tender" })),
  );
  tenderOfA = (await res.json()) as Tender;
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
