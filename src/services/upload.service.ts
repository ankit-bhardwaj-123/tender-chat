import { randomUUID } from "node:crypto";
import { isStorageKeyUsed } from "@/repositories/upload.repository";
import { contentTypeOfKey } from "@/server/adapters/blob-storage";
import { storage } from "@/server/adapters/file-storage";
import { invalid } from "@/server/errors";
import { reportError } from "@/server/report-error";
import type { UploadKind, UploadRef } from "@/types";

export interface UploadedFile {
  key: string;
  fileName: string;
  size: number;
}

export interface UploadTokenLimits {
  maximumSizeInBytes: number;
  allowedContentTypes: string[];
}

export interface UploadLimit {
  maxBytes: number;
  extensions: readonly string[];
}

const MB = 1024 * 1024;

export const UPLOAD_LIMITS: Record<UploadKind, UploadLimit> = {
  companyFile: { maxBytes: 10 * MB, extensions: ["pdf", "jpg", "jpeg"] },
  template: { maxBytes: 2 * MB, extensions: ["html", "htm"] },
};

const KEY_PATTERN = /^uploads\/([0-9a-f-]{36})\/[0-9a-f-]{36}\.([a-z0-9]{1,5})$/;
const FILE_NAME_MAX_LENGTH = 1000;

function extensionOf(fileName: string): string | null {
  return fileName.toLowerCase().match(/\.([a-z0-9]{1,5})$/)?.[1] ?? null;
}

export function isUploadKind(value: unknown): value is UploadKind {
  return typeof value === "string" && Object.hasOwn(UPLOAD_LIMITS, value);
}

export function uploadKey(userId: string, kind: UploadKind, fileName: string): string {
  const allowed = UPLOAD_LIMITS[kind].extensions;
  const extension = extensionOf(fileName);
  const chosen = extension && allowed.includes(extension) ? extension : allowed[0];
  return `uploads/${userId}/${randomUUID()}.${chosen}`;
}

export function checkUploadPath(
  userId: string,
  kind: unknown,
  pathname: string,
): UploadTokenLimits {
  if (!isUploadKind(kind)) {
    throw invalid("Unknown upload kind.");
  }
  const limit = UPLOAD_LIMITS[kind];
  const match = pathname.match(KEY_PATTERN);
  if (!match || match[1] !== userId || !limit.extensions.includes(match[2] ?? "")) {
    throw invalid("This upload path is not allowed.");
  }
  return {
    maximumSizeInBytes: limit.maxBytes,
    allowedContentTypes: [...new Set(limit.extensions.map((ext) => baseContentType(`f.${ext}`)))],
  };
}

function baseContentType(key: string): string {
  return contentTypeOfKey(key).split(";")[0]?.trim() ?? "";
}

export async function receiveUpload(
  userId: string,
  kind: UploadKind,
  file: File | UploadRef,
): Promise<UploadedFile> {
  if (file instanceof File) {
    const key = uploadKey(userId, kind, file.name);
    await storage.save(key, file);
    return { key, fileName: file.name, size: file.size };
  }

  const match = file.key.match(KEY_PATTERN);
  if (
    !match ||
    match[1] !== userId ||
    !UPLOAD_LIMITS[kind].extensions.includes(match[2] ?? "") ||
    file.fileName.length > FILE_NAME_MAX_LENGTH
  ) {
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

export async function readUploadBytes(upload: UploadedFile): Promise<Uint8Array> {
  return new Uint8Array(await (await storage.open(upload.key)).arrayBuffer());
}

export async function discardUpload(upload: UploadedFile): Promise<void> {
  try {
    if (await isStorageKeyUsed(upload.key)) return;
    await storage.delete(upload.key);
  } catch (error) {
    reportError(error);
  }
}
