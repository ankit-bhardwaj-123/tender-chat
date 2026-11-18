import { createWriteStream, openAsBlob } from "node:fs";
import { mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { notFound } from "../errors";
import type { FileStorage } from "./file-storage";

export interface LocalFileStorage extends FileStorage {
  pathOf(key: string): string;
}

export function resolveStoragePath(rootDir: string, key: string): string {
  const resolved = path.resolve(rootDir, key);
  if (!resolved.startsWith(rootDir + path.sep)) {
    throw new Error(`Storage key escapes the storage folder: ${key}`);
  }
  return resolved;
}

export function hasErrorCode(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && (error as { code: string }).code === code;
}

export function createLocalStorage(rootDir = path.resolve("storage")): LocalFileStorage {
  async function existing(key: string): Promise<{ target: string; size: number }> {
    const target = resolveStoragePath(rootDir, key);
    const info = await stat(target).catch((error: unknown) => {
      throw hasErrorCode(error, "ENOENT") ? notFound("The file is missing.") : error;
    });
    return { target, size: info.size };
  }

  return {
    async save(key: string, file: Blob): Promise<void> {
      const target = resolveStoragePath(rootDir, key);
      await mkdir(path.dirname(target), { recursive: true });
      try {
        await pipeline(
          Readable.fromWeb(file.stream() as NodeReadableStream<Uint8Array>),
          createWriteStream(target, { flags: "wx" }),
        );
      } catch (error) {
        if (!hasErrorCode(error, "EEXIST")) {
          await rm(target, { force: true });
        }
        throw error;
      }
    },

    async open(key: string): Promise<Blob> {
      const { target } = await existing(key);
      return openAsBlob(target, { type: "application/pdf" });
    },

    async size(key: string): Promise<number> {
      return (await existing(key)).size;
    },

    async read(key, range) {
      const { target } = await existing(key);
      const file = await openAsBlob(target);
      return (range ? file.slice(range.start, range.end + 1) : file).stream();
    },

    async delete(key: string): Promise<void> {
      const target = resolveStoragePath(rootDir, key);
      await rm(target, { force: true });
    },

    pathOf(key: string): string {
      return resolveStoragePath(rootDir, key);
    },
  };
}
