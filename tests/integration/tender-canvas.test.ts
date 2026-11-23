import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as imageRoute from "@/app/api/tenders/[id]/images/[imageId]/route";
import * as imagesRoute from "@/app/api/tenders/[id]/images/route";
import * as tenderRoute from "@/app/api/tenders/[id]/route";
import * as tendersRoute from "@/app/api/tenders/route";
import * as templatesRoute from "@/app/api/templates/route";
import { storage } from "@/server/adapters/file-storage";
import { db } from "@/server/adapters/postgres";
import { tenderImage } from "@/server/schema";
import { uploadKey } from "@/services/upload.service";
import type { Template, CreatedTender, Tender, TenderImage } from "@/types";
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
const GIF = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 1]);
const HTML = "<html><body><p>{{officer}}</p></body></html>";
const UUID_FILE = /^[0-9a-f-]{36}\.(jpg|jpeg|png)$/;

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

async function createTemplate(as: TestUser, name: string): Promise<Template> {
  const form = new FormData();
  form.append("name", name);
  form.append("language", "hi");
  form.append("file", new File([HTML], "q.html"));
  const res = await templatesRoute.POST(apiRequest(as, "/x", { method: "POST", body: form }));
  expect(res.status).toBe(201);
  return (await res.json()) as Template;
}

function patch(as: TestUser | null, tenderId: string, body: unknown): Promise<Response> {
  return tenderRoute.PATCH(apiRequest(as, "/x", jsonBody("PATCH", body)), idParams(tenderId));
}

async function read(as: TestUser, tenderId: string): Promise<Tender> {
  return (await (await tenderRoute.GET(apiRequest(as, "/x"), idParams(tenderId))).json()) as Tender;
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

function uploadRef(as: TestUser, tenderId: string, key: string, fileName: string) {
  return imagesRoute.POST(
    apiRequest(as, "/x", jsonBody("POST", { file: { key, fileName } })),
    idParams(tenderId),
  );
}

function imageParams(id: string, imageId: string) {
  return { params: Promise.resolve({ id, imageId }) };
}

function getImage(as: TestUser | null, tenderId: string, imageId: string) {
  return imageRoute.GET(apiRequest(as, "/x"), imageParams(tenderId, imageId));
}

function deleteImage(as: TestUser | null, tenderId: string, imageId: string) {
  return imageRoute.DELETE(
    apiRequest(as, "/x", { method: "DELETE" }),
    imageParams(tenderId, imageId),
  );
}

async function errorMessage(res: Response): Promise<string | undefined> {
  return ((await res.json()) as { error?: { message?: string } }).error?.message;
}

function textCanvas(text: string) {
  return {
    items: [{ id: "a", kind: "text", x: 12.5, y: 330, width: 70, height: 10, text, imageId: null }],
    seal: { shown: true, x: 140.25, y: 610, width: 40 },
  };
}

describe("tender canvas and edited page", () => {
  it("returns the canvas with the same keys in the same order, so autosave sees no change", async () => {
    const tender = await createTender(owner);
    const canvas = textCanvas("नमस्ते 🙂");
    const res = await patch(owner, tender.id, { canvas });
    expect(res.status).toBe(200);
    expect(JSON.stringify(((await res.json()) as Tender).canvas)).toBe(JSON.stringify(canvas));
    expect(JSON.stringify((await read(owner, tender.id)).canvas)).toBe(JSON.stringify(canvas));
  });

  it("stores markup typed into a text box as plain text without changing it", async () => {
    const tender = await createTender(owner);
    const canvas = textCanvas("<script>alert(1)</script> {{officer}}");
    await patch(owner, tender.id, { canvas });
    expect((await read(owner, tender.id)).canvas.items[0]?.text).toBe(
      "<script>alert(1)</script> {{officer}}",
    );
  });

  it("drops an edited page sent together with a template change", async () => {
    const first = await createTemplate(owner, "First");
    const second = await createTemplate(owner, "Second");
    const tender = await createTender(owner);
    await patch(owner, tender.id, { templateId: null });
    await patch(owner, tender.id, { templateId: first.id, customHtml: "<p>new page</p>" });
    expect((await read(owner, tender.id)).customHtml).toBeNull();
    await patch(owner, tender.id, { customHtml: "<p>old edits</p>" });
    const res = await patch(owner, tender.id, {
      templateId: second.id,
      customHtml: "<p>old edits</p>",
    });
    expect(((await res.json()) as Tender).customHtml).toBeNull();
  });

  it("clears the edited page when the template is unset", async () => {
    const first = await createTemplate(owner, "Only");
    const tender = await createTender(owner);
    await patch(owner, tender.id, { templateId: first.id });
    await patch(owner, tender.id, { customHtml: "<p>edited</p>" });
    const res = await patch(owner, tender.id, { templateId: null });
    expect(((await res.json()) as Tender).customHtml).toBeNull();
  });

  it("writes nothing when the canvas in a PATCH is malformed", async () => {
    const tender = await createTender(owner);
    await patch(owner, tender.id, { canvas: textCanvas("first") });
    const bad = { ...textCanvas("second"), seal: { shown: true, x: null, y: null } };
    const res = await patch(owner, tender.id, { values: { officer: "x" }, canvas: bad });
    expect(res.status).toBe(400);
    const after = await read(owner, tender.id);
    expect(after.values).toEqual({});
    expect(after.canvas.items[0]?.text).toBe("first");
  });

  it("answers 404 and changes nothing when another user saves an edited page or canvas", async () => {
    const tender = await createTender(owner);
    const res = await patch(stranger, tender.id, {
      customHtml: "<p>taken</p>",
      canvas: textCanvas("taken"),
    });
    expect(res.status).toBe(404);
    const after = await read(owner, tender.id);
    expect(after.customHtml).toBeNull();
    expect(after.canvas.items).toEqual([]);
  });

  it("answers 401 to a signed-out PATCH of the canvas", async () => {
    const tender = await createTender(owner);
    expect((await patch(null, tender.id, { canvas: textCanvas("x") })).status).toBe(401);
  });
});

describe("tender images edges", () => {
  it("answers 401 to a signed-out GET or DELETE of an image", async () => {
    const tender = await createTender(owner);
    const image = (await (await upload(owner, tender.id, JPG, "a.jpg")).json()) as TenderImage;
    expect((await getImage(null, tender.id, image.id)).status).toBe(401);
    expect((await deleteImage(null, tender.id, image.id)).status).toBe(401);
    expect((await getImage(owner, tender.id, image.id)).status).toBe(200);
  });

  it("answers 404 for an image asked for through the owner's other tender or a malformed id", async () => {
    const tender = await createTender(owner);
    const other = await createTender(owner);
    const image = (await (await upload(owner, tender.id, JPG, "a.jpg")).json()) as TenderImage;
    expect((await getImage(owner, other.id, image.id)).status).toBe(404);
    expect((await deleteImage(owner, other.id, image.id)).status).toBe(404);
    expect((await getImage(owner, tender.id, "not-a-uuid")).status).toBe(404);
    expect((await getImage(owner, tender.id, image.id)).status).toBe(200);
  });

  it("decides the type by the bytes, not the file name", async () => {
    const tender = await createTender(owner);
    const png = await upload(owner, tender.id, PNG, "looks-like.jpg");
    expect(png.status).toBe(201);
    const served = await getImage(owner, tender.id, ((await png.json()) as TenderImage).id);
    expect(served.headers.get("content-type")).toBe("image/png");
    const gif = await upload(owner, tender.id, GIF, "picture.png");
    expect(gif.status).toBe(400);
    expect(await errorMessage(gif)).toBe("Image must be a JPG or PNG.");
  });

  it("refuses an empty file and a PNG cut off before its signature ends", async () => {
    const tender = await createTender(owner);
    const empty = await upload(owner, tender.id, new Uint8Array(), "a.png");
    expect(empty.status).toBe(400);
    expect(await errorMessage(empty)).toBe("The image is empty.");
    const cut = await upload(owner, tender.id, PNG.slice(0, 4), "a.png");
    expect(cut.status).toBe(400);
    expect(await errorMessage(cut)).toBe("Image must be a JPG or PNG.");
  });

  it("builds the storage key itself and cleans a file name that tries path traversal", async () => {
    const tender = await createTender(owner);
    const before = await uploadedFiles(owner.id);
    const res = await upload(owner, tender.id, JPG, "..\\..\\evil.jpg");
    expect(res.status).toBe(201);
    const image = (await res.json()) as TenderImage;
    expect(image.fileName).not.toMatch(/[\\/]/);
    const added = (await uploadedFiles(owner.id)).filter((name) => !before.includes(name));
    expect(added).toHaveLength(1);
    expect(added[0]).toMatch(UUID_FILE);
  });

  it("serves a Hindi file name in a safe Content-Disposition header", async () => {
    const tender = await createTender(owner);
    const image = (await (await upload(owner, tender.id, JPG, "मुहर.jpg")).json()) as TenderImage;
    expect(image.fileName).toBe("मुहर.jpg");
    const served = await getImage(owner, tender.id, image.id);
    expect(served.headers.get("content-disposition")).toBe(
      `inline; filename*=UTF-8''${encodeURIComponent("मुहर.jpg")}`,
    );
    expect(served.headers.get("cache-control")).toBe("private, no-store");
  });

  it("saves an image sent as a Blob upload reference once, and refuses it a second time", async () => {
    const tender = await createTender(owner);
    const key = uploadKey(owner.id, "tenderImage", "direct.png");
    await storage.save(key, new Blob([PNG]));
    const first = await uploadRef(owner, tender.id, key, "direct.png");
    expect(first.status).toBe(201);
    const again = await uploadRef(owner, tender.id, key, "direct.png");
    expect(again.status).toBe(400);
  });

  it("refuses a Blob reference in another user's folder or with a non-image extension", async () => {
    const tender = await createTender(owner);
    const foreign = uploadKey(stranger.id, "tenderImage", "x.png");
    await storage.save(foreign, new Blob([PNG]));
    expect((await uploadRef(owner, tender.id, foreign, "x.png")).status).toBe(400);
    const pdfKey = uploadKey(owner.id, "companyFile", "x.pdf");
    expect((await uploadRef(owner, tender.id, pdfKey, "x.pdf")).status).toBe(400);
  });

  it("removes the image rows when the tender is deleted", async () => {
    const tender = await createTender(owner);
    await upload(owner, tender.id, JPG, "a.jpg");
    await upload(owner, tender.id, PNG, "b.png");
    const res = await tenderRoute.DELETE(
      apiRequest(owner, "/x", { method: "DELETE" }),
      idParams(tender.id),
    );
    expect(res.status).toBe(204);
    const rows = await db.select().from(tenderImage).where(eq(tenderImage.tenderId, tender.id));
    expect(rows).toEqual([]);
  });

  it("answers 404 and removes nothing when another user deletes the tender", async () => {
    const tender = await createTender(owner);
    await upload(owner, tender.id, JPG, "a.jpg");
    const before = await uploadedFiles(owner.id);
    const res = await tenderRoute.DELETE(
      apiRequest(stranger, "/x", { method: "DELETE" }),
      idParams(tender.id),
    );
    expect(res.status).toBe(404);
    expect((await uploadedFiles(owner.id)).sort()).toEqual([...before].sort());
  });
});
