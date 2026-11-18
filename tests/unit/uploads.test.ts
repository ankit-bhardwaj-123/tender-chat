import path from "node:path";
import { describe, expect, it } from "vitest";
import { contentTypeOfKey } from "@/server/adapters/blob-storage";
import { resolveStoragePath } from "@/server/adapters/local-storage";
import { encodeFileName, readUploads } from "@/server/http";
import { checkUploadPath, UPLOAD_LIMITS, uploadKey } from "@/services/upload.service";

const USER = "11111111-2222-4333-8444-555555555555";
const OTHER = "99999999-2222-4333-8444-555555555555";
const FILE_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const ROOT = path.resolve("storage-test-root");

interface ErrorWithMessage {
  message: string;
}

async function messageOf(work: Promise<unknown>): Promise<string> {
  try {
    await work;
  } catch (error) {
    return (error as ErrorWithMessage).message;
  }
  return "no error";
}

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/x", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("upload keys", () => {
  it("builds the key from the user id and a random id when the name has a known extension", () => {
    expect(uploadKey(USER, "companyFile", "My Letterhead.PDF")).toMatch(
      new RegExp(`^uploads/${USER}/[0-9a-f-]{36}\\.pdf$`),
    );
  });

  it("keeps no user text in the key when the name tries path traversal", () => {
    const key = uploadKey(USER, "companyFile", "../../etc/passwd");
    expect(key).toMatch(new RegExp(`^uploads/${USER}/[0-9a-f-]{36}\\.pdf$`));
    expect(key).not.toContain("..");
  });

  it("falls back to pdf when the extension is not allowed", () => {
    expect(uploadKey(USER, "companyFile", "seal.exe").endsWith(".pdf")).toBe(true);
    expect(uploadKey(USER, "companyFile", "seal.jpeg").endsWith(".jpeg")).toBe(true);
  });

  it("gives a new key on every call", () => {
    expect(uploadKey(USER, "companyFile", "a.jpg")).not.toBe(
      uploadKey(USER, "companyFile", "a.jpg"),
    );
  });
});

describe("blob upload path check", () => {
  it("allows the user's own key with a 10 MB limit and pdf/jpeg types", () => {
    expect(checkUploadPath(USER, "companyFile", `uploads/${USER}/${FILE_ID}.jpg`)).toEqual({
      maximumSizeInBytes: UPLOAD_LIMITS.companyFile.maxBytes,
      allowedContentTypes: ["application/pdf", "image/jpeg"],
    });
  });

  it("refuses another user's folder", () => {
    expect(() => checkUploadPath(USER, "companyFile", `uploads/${OTHER}/${FILE_ID}.jpg`)).toThrow(
      "This upload path is not allowed.",
    );
  });

  it("refuses traversal, other extensions and free text", () => {
    for (const pathname of [
      `uploads/${USER}/../${OTHER}/${FILE_ID}.jpg`,
      `uploads/${USER}/${FILE_ID}.png`,
      `uploads/${USER}/${FILE_ID}.html`,
      `uploads/${USER}/letterhead.pdf`,
      `other/${USER}/${FILE_ID}.pdf`,
    ]) {
      expect(() => checkUploadPath(USER, "companyFile", pathname)).toThrow(
        "This upload path is not allowed.",
      );
    }
  });
});

describe("template uploads", () => {
  it("gives an html key and falls back to html for a wrong extension", () => {
    expect(uploadKey(USER, "template", "Quote.HTML").endsWith(".html")).toBe(true);
    expect(uploadKey(USER, "template", "quote.htm").endsWith(".htm")).toBe(true);
    expect(uploadKey(USER, "template", "quote.pdf").endsWith(".html")).toBe(true);
  });

  it("allows an html path with a 2 MB limit and refuses a pdf path", () => {
    expect(checkUploadPath(USER, "template", `uploads/${USER}/${FILE_ID}.html`)).toEqual({
      maximumSizeInBytes: 2 * 1024 * 1024,
      allowedContentTypes: ["text/html; charset=utf-8"],
    });
    expect(() => checkUploadPath(USER, "template", `uploads/${USER}/${FILE_ID}.pdf`)).toThrow(
      "This upload path is not allowed.",
    );
  });

  it("refuses an unknown upload kind", () => {
    for (const kind of ["document", "", null, 3]) {
      expect(() => checkUploadPath(USER, kind, `uploads/${USER}/${FILE_ID}.pdf`)).toThrow(
        "Unknown upload kind.",
      );
    }
  });
});

describe("storage paths", () => {
  it("resolves a normal key inside the storage folder", () => {
    expect(resolveStoragePath(ROOT, `uploads/${USER}/${FILE_ID}.pdf`)).toBe(
      path.join(ROOT, "uploads", USER, `${FILE_ID}.pdf`),
    );
  });

  it("throws when the key escapes the storage folder", () => {
    expect(() => resolveStoragePath(ROOT, "../secret.txt")).toThrow();
    expect(() => resolveStoragePath(ROOT, `uploads/../../x`)).toThrow();
    expect(() => resolveStoragePath(ROOT, "")).toThrow();
  });

  it("maps key extensions to content types and unknown ones to octet-stream", () => {
    expect(contentTypeOfKey("a/b.pdf")).toBe("application/pdf");
    expect(contentTypeOfKey("a/b.JPEG")).toBe("image/jpeg");
    expect(contentTypeOfKey("a/b.html")).toBe("text/html; charset=utf-8");
    expect(contentTypeOfKey("a/b.exe")).toBe("application/octet-stream");
  });
});

describe("file name header", () => {
  it("encodes Hindi, spaces and quote characters so the header stays one safe value", () => {
    const encoded = encodeFileName("शिव (seal) 'v2'*.jpg");
    expect(encoded).not.toMatch(/[\s'()*"]/);
    expect(decodeURIComponent(encoded)).toBe("शिव (seal) 'v2'*.jpg");
  });

  it("encodes CR, LF and semicolons so no header can be injected", () => {
    const encoded = encodeFileName('a";\r\nSet-Cookie: x=1.pdf');
    expect(encoded).not.toMatch(/[\r\n";]/);
  });
});

describe("readUploads", () => {
  it("reads a form file when the body is a form", async () => {
    const form = new FormData();
    form.append("file", new File([new Uint8Array([1])], "a.jpg"));
    const request = new Request("http://localhost/x", { method: "PUT", body: form });
    const { files } = await readUploads(request, { file: "The form has no file." });
    expect(files.file).toBeInstanceOf(File);
  });

  it("refuses a form with no file with the given message", async () => {
    const form = new FormData();
    form.append("file", "just text");
    const request = new Request("http://localhost/x", { method: "PUT", body: form });
    expect(await messageOf(readUploads(request, { file: "The form has no file." }))).toBe(
      "The form has no file.",
    );
  });

  it("reads a Blob reference when the body is JSON", async () => {
    const ref = { key: `uploads/${USER}/${FILE_ID}.pdf`, fileName: "lh.pdf" };
    const { files } = await readUploads(jsonRequest({ file: ref }), { file: "No file." });
    expect(files.file).toEqual(ref);
  });

  it("refuses JSON with a missing or malformed reference", async () => {
    expect(await messageOf(readUploads(jsonRequest({}), { file: "No file." }))).toBe("No file.");
    expect(
      await messageOf(
        readUploads(jsonRequest({ file: { key: "", fileName: "x" } }), { file: "No file." }),
      ),
    ).toBe("No file.");
    expect(await messageOf(readUploads(jsonRequest([1]), { file: "No file." }))).toBe(
      "The request body is not valid.",
    );
  });

  it("refuses a body that is neither a form nor JSON", async () => {
    const request = new Request("http://localhost/x", { method: "PUT", body: "plain" });
    expect(await messageOf(readUploads(request, { file: "No file." }))).toBe(
      "The request must be a form with a file.",
    );
  });
});
