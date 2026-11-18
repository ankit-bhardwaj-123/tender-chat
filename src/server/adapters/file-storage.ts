import { env } from "../env";
import { createBlobStorage } from "./blob-storage";
import { createLocalStorage } from "./local-storage";

export interface ByteRange {
  start: number;
  end: number;
}

export interface FileStorage {
  save(key: string, file: Blob): Promise<void>;
  open(key: string): Promise<Blob>;
  size(key: string): Promise<number>;
  read(key: string, range: ByteRange | null): Promise<ReadableStream<Uint8Array>>;
  delete(key: string): Promise<void>;
}

export function usesBlobStore(): boolean {
  return env.NEXT_PUBLIC_FILE_STORE === "blob";
}

let picked: FileStorage | null = null;

function pick(): FileStorage {
  if (!picked) {
    picked = usesBlobStore() ? createBlobStorage(env.BLOB_READ_WRITE_TOKEN) : createLocalStorage();
  }
  return picked;
}

export const storage: FileStorage = {
  save: (key, file) => pick().save(key, file),
  open: (key) => pick().open(key),
  size: (key) => pick().size(key),
  read: (key, range) => pick().read(key, range),
  delete: (key) => pick().delete(key),
};
