import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as imagesRoute from "@/app/api/tenders/[id]/images/route";
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
  uploadedFiles,
} from "./users";

const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

let owner: TestUser;
let stranger: TestUser;

beforeAll(async () => {
  [owner, stranger] = await Promise.all([createSignedInUser(), createSignedInUser()]);
});

afterAll(async () => {
  await deleteUsers([owner, stranger]);
});

async function create(as: TestUser, body: object): Promise<CreatedTender> {
  const res = await tendersRoute.POST(apiRequest(as, "/x", jsonBody("POST", body)));
  expect(res.status).toBe(201);
  return (await res.json()) as CreatedTender;
}

async function list(as: TestUser, search = ""): Promise<Tender[]> {
  const res = await tendersRoute.GET(
    apiRequest(as, `/api/tenders?search=${encodeURIComponent(search)}`),
  );
  return (await res.json()) as Tender[];
}

function move(as: TestUser, id: string, parentId: string | null) {
  return tenderRoute.PATCH(apiRequest(as, "/x", jsonBody("PATCH", { parentId })), idParams(id));
}

async function errorMessage(res: Response): Promise<string> {
  return ((await res.json()) as { error: { message: string } }).error.message;
}

describe("creating subfolders", () => {
  it("creates the tender and its subfolder together", async () => {
    const created = await create(owner, { name: "Road", subfolderName: "Letter A" });
    expect(created.tender.parentId).toBeNull();
    expect(created.subfolder?.name).toBe("Letter A");
    expect(created.subfolder?.parentId).toBe(created.tender.id);
  });

  it("creates only the tender when the subfolder name is empty", async () => {
    const created = await create(owner, { name: "Bridge", subfolderName: "   " });
    expect(created.subfolder).toBeNull();
  });

  it("creates a subfolder under a given folder", async () => {
    const { tender } = await create(owner, { name: "Parent" });
    const { tender: child } = await create(owner, { name: "Child", parentId: tender.id });
    expect(child.parentId).toBe(tender.id);
  });

  it("answers 404 for another user's parent", async () => {
    const { tender } = await create(owner, { name: "Mine" });
    const res = await tendersRoute.POST(
      apiRequest(stranger, "/x", jsonBody("POST", { name: "X", parentId: tender.id })),
    );
    expect(res.status).toBe(404);
  });
});

describe("moving folders", () => {
  it("moves a folder into another and back to the top, keeping its editor state", async () => {
    const { tender: a } = await create(owner, { name: "Move A" });
    const { tender: b } = await create(owner, { name: "Move B" });
    await tenderRoute.PATCH(
      apiRequest(owner, "/x", jsonBody("PATCH", { values: { rate: "500" } })),
      idParams(a.id),
    );
    const moved = await move(owner, a.id, b.id);
    expect(moved.status).toBe(200);
    const body = (await moved.json()) as Tender;
    expect(body.parentId).toBe(b.id);
    expect(body.values).toEqual({ rate: "500" });
    const back = (await (await move(owner, a.id, null)).json()) as Tender;
    expect(back.parentId).toBeNull();
  });

  it("refuses a move into itself or one of its own subfolders", async () => {
    const { tender: top, subfolder } = await create(owner, {
      name: "Loop top",
      subfolderName: "Loop child",
    });
    const self = await move(owner, top.id, top.id);
    expect(self.status).toBe(400);
    expect(await errorMessage(self)).toBe("A folder can't go inside itself or its own subfolder.");
    expect((await move(owner, top.id, subfolder?.id ?? "")).status).toBe(400);
  });

  it("answers 404 for another user's folder or target", async () => {
    const { tender: mine } = await create(owner, { name: "Owner folder" });
    const { tender: theirs } = await create(stranger, { name: "Stranger folder" });
    expect((await move(stranger, mine.id, null)).status).toBe(404);
    expect((await move(owner, mine.id, theirs.id)).status).toBe(404);
  });
});

describe("search and delete", () => {
  it("finds a subfolder by name and returns the folders above it", async () => {
    const { tender, subfolder } = await create(owner, {
      name: "Search top",
      subfolderName: "जलापूर्ति पत्र",
    });
    const ids = (await list(owner, "जलापूर्ति")).map((t) => t.id);
    expect(ids).toContain(tender.id);
    expect(ids).toContain(subfolder?.id);
  });

  it("deletes the subfolders and their image files with the folder", async () => {
    const { tender, subfolder } = await create(owner, {
      name: "Delete top",
      subfolderName: "Delete child",
    });
    const childId = subfolder?.id ?? "";
    const before = await uploadedFiles(owner.id);
    const form = new FormData();
    form.append("file", new File([JPG], "a.jpg"));
    const uploaded = await imagesRoute.POST(
      apiRequest(owner, "/x", { method: "POST", body: form }),
      idParams(childId),
    );
    expect(uploaded.status).toBe(201);
    expect((await uploadedFiles(owner.id)).length).toBe(before.length + 1);

    const res = await tenderRoute.DELETE(
      apiRequest(owner, "/x", { method: "DELETE" }),
      idParams(tender.id),
    );
    expect(res.status).toBe(204);
    const gone = await tenderRoute.GET(apiRequest(owner, "/x"), idParams(childId));
    expect(gone.status).toBe(404);
    expect((await uploadedFiles(owner.id)).sort()).toEqual([...before].sort());
  });

  it("answers 404 when another user deletes a folder", async () => {
    const { tender } = await create(owner, { name: "Keep me" });
    const res = await tenderRoute.DELETE(
      apiRequest(stranger, "/x", { method: "DELETE" }),
      idParams(tender.id),
    );
    expect(res.status).toBe(404);
  });
});
