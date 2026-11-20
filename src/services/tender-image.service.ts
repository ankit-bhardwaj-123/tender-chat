import { findTenderById } from "@/repositories/tender.repository";
import {
  deleteTenderImage,
  findTenderImage,
  insertTenderImage,
} from "@/repositories/tender-image.repository";
import { storage } from "@/server/adapters/file-storage";
import { invalid, notFound } from "@/server/errors";
import { reportError } from "@/server/report-error";
import { toTenderImage } from "@/shared/dto";
import type { TenderImage } from "@/types";
import { discardUpload, readUploadHead, UPLOAD_LIMITS, type UploadedFile } from "./upload.service";

export interface TenderImageFile {
  fileName: string;
  contentType: string;
  size: number;
  file: ReadableStream<Uint8Array>;
}

interface ImageSignature {
  bytes: readonly number[];
  contentType: string;
}

const MAX_IMAGE_BYTES = UPLOAD_LIMITS.tenderImage.maxBytes;
const WRONG_TYPE = "Image must be a JPG or PNG.";
const TOO_BIG = `Image must be at most ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`;
const EMPTY = "The image is empty.";
const TENDER_NOT_FOUND = "Tender not found.";
const IMAGE_NOT_FOUND = "Image not found.";
const FILE_NAME_MAX_LENGTH = 200;

const SIGNATURES: readonly ImageSignature[] = [
  { bytes: [0xff, 0xd8, 0xff], contentType: "image/jpeg" },
  { bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], contentType: "image/png" },
];

function cleanFileName(raw: string): string {
  const name = raw
    .normalize("NFC")
    .replace(/[\p{Cc}/\\]/gu, "")
    .trim();
  if (name === "") return "image";
  return name.length > FILE_NAME_MAX_LENGTH ? name.slice(-FILE_NAME_MAX_LENGTH) : name;
}

async function imageType(upload: UploadedFile): Promise<string> {
  if (upload.size === 0) throw invalid(EMPTY);
  if (upload.size > MAX_IMAGE_BYTES) throw invalid(TOO_BIG);
  const head = await readUploadHead(upload, 8);
  const match = SIGNATURES.find((signature) =>
    signature.bytes.every((byte, index) => head[index] === byte),
  );
  if (!match) throw invalid(WRONG_TYPE);
  return match.contentType;
}

export async function saveTenderImage(
  userId: string,
  tenderId: string,
  upload: UploadedFile,
): Promise<TenderImage> {
  try {
    if (!(await findTenderById(userId, tenderId))) {
      throw notFound(TENDER_NOT_FOUND);
    }
    const contentType = await imageType(upload);
    const row = await insertTenderImage({
      tenderId,
      storageKey: upload.key,
      fileName: cleanFileName(upload.fileName),
      contentType,
      sizeBytes: upload.size,
    });
    return toTenderImage(row);
  } catch (error) {
    await discardUpload(upload);
    throw error;
  }
}

export async function openTenderImage(
  userId: string,
  tenderId: string,
  imageId: string,
): Promise<TenderImageFile> {
  const owned = await findTenderById(userId, tenderId);
  const row = owned ? await findTenderImage(tenderId, imageId) : null;
  if (!row) {
    throw notFound(IMAGE_NOT_FOUND);
  }
  try {
    const size = await storage.size(row.storageKey);
    const file = await storage.read(row.storageKey, null);
    return { fileName: row.fileName, contentType: row.contentType, size, file };
  } catch (error) {
    reportError(error);
    throw notFound(IMAGE_NOT_FOUND);
  }
}

export async function removeTenderImage(
  userId: string,
  tenderId: string,
  imageId: string,
): Promise<void> {
  const owned = await findTenderById(userId, tenderId);
  const storageKey = owned ? await deleteTenderImage(tenderId, imageId) : null;
  if (!storageKey) {
    throw notFound(IMAGE_NOT_FOUND);
  }
  await storage.delete(storageKey).catch((error: unknown) => reportError(error));
}
