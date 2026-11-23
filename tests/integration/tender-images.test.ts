import { rm } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as imageRoute from "@/app/api/tenders/[id]/images/[imageId]/route";
import * as imagesRoute from "@/app/api/tenders/[id]/images/route";
import * as tenderRoute from "@/app/api/tenders/[id]/route";
import * as tendersRoute from "@/app/api/tenders/route";
import type { CreatedTender, Tender, TenderImage } from "@/types";
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
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9, 9]);
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 1]);
const FIVE_MB = 5 * 1024 * 1024;

let owner: TestUser;
let stranger: TestUser;

beforeAll(async () => {
  [owner, stranger] = await Promise.all([createSignedInUser(), createSignedInUser()]);
});

afterAll(async () => {
  await deleteUsers([owner, stranger]);
});

async function createTender(as: TestUser): Promise<Tender> {
  const res = await tendersRoute.POST(apiRequest(as, "/x", jsonBody("POST", { name: "Road" })));
  expect(res.status).toBe(201);
  return ((await res.json()) as CreatedTender).tender;
}

function upload(
  as: TestUser | null,
  tenderId: string,
  bytes: Uint8Array<ArrayBuffer>,
  name: string,
) {
  const form = new FormData();
  form.append("file", new File([bytes], name));
  return imagesRoute.POST(apiRequest(as, "/x", { method: "POST", body: form }), idParams(tenderId));
}

async function uploadImage(tenderId: string, bytes: Uint8Array<ArrayBuffer>, name: string) {
  const res = await upload(owner, tenderId, bytes, name);
  expect(res.status).toBe(201);
  return (await res.json()) as TenderImage;
}

function imageParams(id: string, imageId: string) {
  return { params: Promise.resolve({ id, imageId }) };
}

function getImage(as: TestUser, tenderId: string, imageId: string) {
  return imageRoute.GET(apiRequest(as, "/x"), imageParams(tenderId, imageId));
}

function deleteImage(as: TestUser, tenderId: string, imageId: string) {
  return imageRoute.DELETE(
    apiRequest(as, "/x", { method: "DELETE" }),
    imageParams(tenderId, imageId),
  );
}

async function errorMessage(res: Response): Promise<string | undefined> {
  return ((await res.json()) as { error?: { message?: string } }).error?.message;
}

describe("tender images API", () => {
  it("stores a JPG and a PNG and serves them with their types", async () => {
    const tender = await createTender(owner);
    const jpg = await uploadImage(tender.id, JPG, "photo.jpg");
    expect(jpg.fileName).toBe("photo.jpg");
    const png = await uploadImage(tender.id, PNG, "logo.png");

    const served = await getImage(owner, tender.id, jpg.id);
    expect(served.status).toBe(200);
    expect(served.headers.get("content-type")).toBe("image/jpeg");
    expect(served.headers.get("x-content-type-options")).toBe("nosniff");
    expect(new Uint8Array(await served.arrayBuffer())).toEqual(JPG);
    const servedPng = await getImage(owner, tender.id, png.id);
    expect(servedPng.headers.get("content-type")).toBe("image/png");
  });

  it("refuses a file that isn't a JPG or PNG, whatever its name, and keeps no file", async () => {
    const tender = await createTender(owner);
    const before = await uploadedFiles(owner.id);
    const res = await upload(owner, tender.id, PDF, "fake.jpg");
    expect(res.status).toBe(400);
    expect(await errorMessage(res)).toBe("Image must be a JPG or PNG.");
    expect((await uploadedFiles(owner.id)).sort()).toEqual([...before].sort());
  });

  it("accepts exactly 5 MB and refuses one byte more", async () => {
    const tender = await createTender(owner);
    const exact = new Uint8Array(FIVE_MB);
    exact.set(JPG);
    expect((await upload(owner, tender.id, exact, "big.jpg")).status).toBe(201);
    const over = new Uint8Array(FIVE_MB + 1);
    over.set(JPG);
    const res = await upload(owner, tender.id, over, "bigger.jpg");
    expect(res.status).toBe(400);
    expect(await errorMessage(res)).toBe("Image must be at most 5 MB.");
  });

  it("answers 404, not 500, when an image's stored file has gone missing", async () => {
    const tender = await createTender(owner);
    const before = await uploadedFiles(owner.id);
    const image = await uploadImage(tender.id, JPG, "a.jpg");
    const added = (await uploadedFiles(owner.id)).filter((name) => !before.includes(name));
    expect(added).toHaveLength(1);
    await rm(path.resolve("storage", "uploads", owner.id, added[0] ?? ""));
    expect((await getImage(owner, tender.id, image.id)).status).toBe(404);
  });

  it("removes an image and then answers 404 for it", async () => {
    const tender = await createTender(owner);
    const image = await uploadImage(tender.id, JPG, "a.jpg");
    expect((await deleteImage(owner, tender.id, image.id)).status).toBe(204);
    expect((await getImage(owner, tender.id, image.id)).status).toBe(404);
    expect((await deleteImage(owner, tender.id, image.id)).status).toBe(404);
  });

  it("answers 404 for another user's tender or image", async () => {
    const tender = await createTender(owner);
    const image = await uploadImage(tender.id, JPG, "a.jpg");
    expect((await upload(stranger, tender.id, JPG, "b.jpg")).status).toBe(404);
    expect((await getImage(stranger, tender.id, image.id)).status).toBe(404);
    expect((await deleteImage(stranger, tender.id, image.id)).status).toBe(404);
    const strangerTender = await createTender(stranger);
    expect((await getImage(stranger, strangerTender.id, image.id)).status).toBe(404);
    expect((await getImage(owner, tender.id, image.id)).status).toBe(200);
  });

  it("answers 401 without a session", async () => {
    const tender = await createTender(owner);
    expect((await upload(null, tender.id, JPG, "a.jpg")).status).toBe(401);
  });

  it("removes the stored image files when the tender is deleted", async () => {
    const tender = await createTender(owner);
    const before = await uploadedFiles(owner.id);
    await uploadImage(tender.id, JPG, "a.jpg");
    await uploadImage(tender.id, PNG, "b.png");
    expect((await uploadedFiles(owner.id)).length).toBe(before.length + 2);
    const res = await tenderRoute.DELETE(
      apiRequest(owner, "/x", { method: "DELETE" }),
      idParams(tender.id),
    );
    expect(res.status).toBe(204);
    expect((await uploadedFiles(owner.id)).sort()).toEqual([...before].sort());
  });
});
