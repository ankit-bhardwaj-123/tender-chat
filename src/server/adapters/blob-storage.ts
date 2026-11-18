import { BlobNotFoundError, del, get, head, put } from "@vercel/blob";
import { notFound } from "../errors";
import type { FileStorage } from "./file-storage";

const MULTIPART_FROM_BYTES = 50 * 1024 * 1024;

const CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
};

export function contentTypeOfKey(key: string): string {
  const extension = key.slice(key.lastIndexOf(".") + 1).toLowerCase();
  return CONTENT_TYPES[extension] ?? "application/octet-stream";
}

function checkKey(key: string): string {
  const parts = key.split("/");
  if (key.includes("\\") || parts.some((part) => part === "" || part === "." || part === "..")) {
    throw new Error(`Storage key escapes the storage folder: ${key}`);
  }
  return key;
}

function missing(): Error {
  return notFound("The file is missing.");
}

export function createBlobStorage(token?: string): FileStorage {
  return {
    async save(key, file) {
      await put(checkKey(key), file, {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: false,
        contentType: contentTypeOfKey(key),
        multipart: file.size >= MULTIPART_FROM_BYTES,
        token,
      });
    },

    async open(key) {
      const found = await get(checkKey(key), { access: "private", token });
      if (!found || found.statusCode !== 200) throw missing();
      const bytes = await new Response(found.stream).arrayBuffer();
      return new Blob([bytes], { type: found.blob.contentType });
    },

    async size(key) {
      try {
        return (await head(checkKey(key), { token })).size;
      } catch (error) {
        if (error instanceof BlobNotFoundError) throw missing();
        throw error;
      }
    },

    async read(key, range) {
      const found = await get(checkKey(key), {
        access: "private",
        token,
        headers: range ? { range: `bytes=${range.start}-${range.end}` } : undefined,
      });
      if (!found || found.statusCode !== 200) throw missing();
      return found.stream;
    },

    async delete(key) {
      await del(checkKey(key), { token });
    },
  };
}
