import { randomUUID } from "node:crypto";
import { isStorageKeyUsed } from "@/repositories/upload.repository";
import { contentTypeOfKey } from "@/server/adapters/blob-storage";
import { storage } from "@/server/adapters/file-storage";
import { invalid } from "@/server/errors";
import { reportError } from "@/server/report-error";
import type { UploadRef } from "@/types";

export interface UploadedFile {
  key: string;
  fileName: string;
  size: number;
}

export interface UploadTokenLimits {
  maximumSizeInBytes: number;
  allowedContentTypes: string[];
}

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const EXTENSIONS: readonly string[] = ["pdf", "jpg", "jpeg"];
const KEY_PATTERN = /^uploads\/([0-9a-f-]{36})\/[0-9a-f-]{36}\.([a-z0-9]{1,5})$/;
const FILE_NAME_MAX_LENGTH = 1000;

function extensionOf(fileName: string): string | null {
  return fileName.toLowerCase().match(/\.([a-z0-9]{1,5})$/)?.[1] ?? null;
}

export function uploadKey(userId: string, fileName: string): string {
  const extension = extensionOf(fileName);
  const chosen = extension && EXTENSIONS.includes(extension) ? extension : EXTENSIONS[0];
  return `uploads/${userId}/${randomUUID()}.${chosen}`;
}

export function checkUploadPath(userId: string, pathname: string): UploadTokenLimits {
  const match = pathname.match(KEY_PATTERN);
  if (!match || match[1] !== userId || !EXTENSIONS.includes(match[2] ?? "")) {
    throw invalid("This upload path is not allowed.");
  }
  return {
    maximumSizeInBytes: MAX_UPLOAD_BYTES,
    allowedContentTypes: [...new Set(EXTENSIONS.map((ext) => contentTypeOfKey(`f.${ext}`)))],
  };
}

export async function receiveUpload(userId: string, file: File | UploadRef): Promise<UploadedFile> {
  if (file instanceof File) {
    const key = uploadKey(userId, file.name);
    await storage.save(key, file);
    return { key, fileName: file.name, size: file.size };
  }

  const match = file.key.match(KEY_PATTERN);
  if (!match || match[1] !== userId || file.fileName.length > FILE_NAME_MAX_LENGTH) {
    throw invalid("Upload the file first.");
  }
  if (await isStorageKeyUsed(file.key)) {
    throw invalid("This file was already saved. Upload it again.");
  }
  const size = await storage.size(file.key).catch(() => {
    throw invalid("Upload the file first.");
  });
  return { key: file.key, fileName: file.fileName, size };
}

export async function readUploadHead(upload: UploadedFile, bytes: number): Promise<Uint8Array> {
  if (upload.size === 0) return new Uint8Array();
  const end = Math.min(bytes, upload.size) - 1;
  const stream = await storage.read(upload.key, { start: 0, end });
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function discardUpload(upload: UploadedFile): Promise<void> {
  try {
    if (await isStorageKeyUsed(upload.key)) return;
    await storage.delete(upload.key);
  } catch (error) {
    reportError(error);
  }
}
