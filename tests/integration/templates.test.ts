import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as fileRoute from "@/app/api/templates/[id]/file/route";
import * as templateRoute from "@/app/api/templates/[id]/route";
import * as templatesRoute from "@/app/api/templates/route";
import type { Template } from "@/types";
import {
  apiRequest,
  createSignedInUser,
  deleteUsers,
  idParams,
  jsonBody,
  type TestUser,
  uploadedFiles,
} from "./users";

const HTML = "<html><body><p>{{officer}}</p><p>{{work_name}} {{work_name}}</p></body></html>";
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

function postTemplate(
  name: string,
  language: string,
  content: BlobPart,
  fileName = "quote.html",
  as: TestUser | null = owner,
): Promise<Response> {
  const form = new FormData();
  form.append("name", name);
  form.append("language", language);
  form.append("file", new File([content], fileName));
  return templatesRoute.POST(apiRequest(as, "/api/templates", { method: "POST", body: form }));
}

async function createTemplate(name = "पैदल मार्च", content: BlobPart = HTML): Promise<Template> {
  const res = await postTemplate(name, "hi", content);
  expect(res.status).toBe(201);
  return (await res.json()) as Template;
}

function putFile(templateId: string, content: BlobPart, fileName = "new.html"): Promise<Response> {
  const form = new FormData();
  form.append("file", new File([content], fileName));
  return fileRoute.PUT(
    apiRequest(owner, `/api/templates/${templateId}/file`, { method: "PUT", body: form }),
    idParams(templateId),
  );
}

async function errorMessage(res: Response): Promise<string | undefined> {
  return ((await res.json()) as { error?: { message?: string } }).error?.message;
}

describe("templates API", () => {
  it("creates a template with a trimmed name, language and its placeholders", async () => {
    const template = await createTemplate("  पैदल   मार्च ");
    expect(template.name).toBe("पैदल मार्च");
    expect(template.language).toBe("hi");
    expect(template.fileName).toBe("quote.html");
    expect(template.size).toBe(new TextEncoder().encode(HTML).length);
    expect(template.placeholders).toEqual(["officer", "work_name"]);
    expect(await storedFiles()).toHaveLength(1);
  });

  it("accepts an HTML file with no placeholders", async () => {
    const template = await createTemplate("Plain", "<p>नमस्ते</p>");
    expect(template.placeholders).toEqual([]);
  });

  it("refuses an empty name or an unknown language and keeps no file", async () => {
    const blank = await postTemplate("  ", "hi", HTML);
    const french = await postTemplate("x", "fr", HTML);
    expect([blank.status, french.status]).toEqual([400, 400]);
    expect(await storedFiles()).toEqual([]);
  });

  it("refuses a create with no file", async () => {
    const form = new FormData();
    form.append("name", "No file");
    form.append("language", "hi");
    const res = await templatesRoute.POST(
      apiRequest(owner, "/api/templates", { method: "POST", body: form }),
    );
    expect(res.status).toBe(400);
  });

  it("lists, reads, renames and changes the language", async () => {
    const template = await createTemplate("Old name");
    const list = (await (
      await templatesRoute.GET(apiRequest(owner, "/api/templates"))
    ).json()) as Template[];
    expect(list.map((item) => item.id)).toContain(template.id);

    const path = `/api/templates/${template.id}`;
    const read = await templateRoute.GET(apiRequest(owner, path), idParams(template.id));
    expect(((await read.json()) as Template).name).toBe("Old name");

    const renamed = await templateRoute.PATCH(
      apiRequest(owner, path, jsonBody("PATCH", { name: "New name" })),
      idParams(template.id),
    );
    expect(((await renamed.json()) as Template).name).toBe("New name");

    const english = await templateRoute.PATCH(
      apiRequest(owner, path, jsonBody("PATCH", { language: "en" })),
      idParams(template.id),
    );
    const changed = (await english.json()) as Template;
    expect(changed.language).toBe("en");
    expect(changed.name).toBe("New name");
    expect(changed.placeholders).toEqual(["officer", "work_name"]);
  });

  it("hides a deleted template from the list and from reads", async () => {
    const template = await createTemplate("To delete");
    const path = `/api/templates/${template.id}`;
    const removed = await templateRoute.DELETE(
      apiRequest(owner, path, { method: "DELETE" }),
      idParams(template.id),
    );
    expect(removed.status).toBe(204);

    const list = (await (
      await templatesRoute.GET(apiRequest(owner, "/api/templates"))
    ).json()) as Template[];
    expect(list.map((item) => item.id)).not.toContain(template.id);
    const read = await templateRoute.GET(apiRequest(owner, path), idParams(template.id));
    expect(read.status).toBe(404);
    const open = await fileRoute.GET(apiRequest(owner, "/x"), idParams(template.id));
    expect(open.status).toBe(404);
  });

  it("opens the HTML as a sandboxed page", async () => {
    const template = await createTemplate();
    const res = await fileRoute.GET(apiRequest(owner, "/x"), idParams(template.id));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(res.headers.get("content-security-policy")).toBe("sandbox");
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.text()).toBe(HTML);
  });

  it("replaces the HTML, updates the placeholders and removes the old stored file", async () => {
    const template = await createTemplate();
    const [firstFile] = await storedFiles();
    const res = await putFile(template.id, "<p>{{rate}} {{date}}</p>", "second.htm");
    expect(res.status).toBe(200);
    const replaced = (await res.json()) as Template;
    expect(replaced.fileName).toBe("second.htm");
    expect(replaced.placeholders).toEqual(["rate", "date"]);
    const files = await storedFiles();
    expect(files).toHaveLength(1);
    expect(files).not.toContain(firstFile);

    const open = await fileRoute.GET(apiRequest(owner, "/x"), idParams(template.id));
    expect(await open.text()).toBe("<p>{{rate}} {{date}}</p>");
  });

  it("refuses wrong files with the right message and keeps none of them", async () => {
    const cases: [BlobPart, string, string][] = [
      [PDF, "quote.pdf", "Upload the layout as an HTML file (.html)."],
      ["", "empty.html", "The HTML layout is empty."],
      [
        new Uint8Array(2 * 1024 * 1024 + 1).fill(0x61),
        "big.html",
        "An HTML layout must be at most 2 MB.",
      ],
      [
        new Uint8Array([0x3c, 0x70, 0x3e, 0xff, 0xfe]),
        "latin.html",
        "Save the HTML layout as UTF-8 text.",
      ],
    ];
    for (const [content, fileName, message] of cases) {
      const res = await postTemplate("Bad", "hi", content, fileName);
      expect(res.status).toBe(400);
      expect(await errorMessage(res)).toBe(message);
    }
    expect(await storedFiles()).toEqual([]);
  });

  it("accepts exactly 2 MB", async () => {
    const res = await postTemplate("Big", "en", new Uint8Array(2 * 1024 * 1024).fill(0x61));
    expect(res.status).toBe(201);
  });

  it("keeps the old file when a replacement is refused", async () => {
    const template = await createTemplate();
    const res = await putFile(template.id, PDF, "wrong.pdf");
    expect(res.status).toBe(400);
    const open = await fileRoute.GET(apiRequest(owner, "/x"), idParams(template.id));
    expect(await open.text()).toBe(HTML);
    expect(await storedFiles()).toHaveLength(1);
  });

  it("answers 404 for a malformed or unknown id", async () => {
    const bad = await templateRoute.GET(apiRequest(owner, "/x"), idParams("not-a-uuid"));
    const unknown = await templateRoute.GET(
      apiRequest(owner, "/x"),
      idParams("00000000-0000-4000-8000-000000000000"),
    );
    expect([bad.status, unknown.status]).toEqual([404, 404]);
    expect(await errorMessage(unknown)).toBe("Template not found.");
  });

  it("needs sign-in", async () => {
    const list = await templatesRoute.GET(apiRequest(null, "/api/templates"));
    const create = await postTemplate("x", "hi", HTML, "quote.html", null);
    expect([list.status, create.status]).toEqual([401, 401]);
  });
});
