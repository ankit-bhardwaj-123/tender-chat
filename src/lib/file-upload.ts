import { upload } from "@vercel/blob/client";
import type { UploadKind, UploadRef } from "@/types";

export interface UploadPart {
  name: string;
  kind: UploadKind;
  file: File;
}

const USES_BLOB = process.env.NEXT_PUBLIC_FILE_STORE === "blob";

const EXTENSIONS: Record<UploadKind, readonly string[]> = {
  companyFile: ["pdf", "jpg", "jpeg"],
  template: ["html", "htm"],
};

let userIdRequest: Promise<string> | null = null;

async function fetchUserId(): Promise<string> {
  const res = await fetch("/api/auth/get-session");
  const body = (await res.json().catch(() => null)) as { user?: { id?: string } } | null;
  const id = body?.user?.id;
  if (!id) throw new Error("Sign in first.");
  return id;
}

async function currentUserId(): Promise<string> {
  userIdRequest ??= fetchUserId();
  try {
    return await userIdRequest;
  } catch (error) {
    userIdRequest = null;
    throw error;
  }
}

function uploadPath(userId: string, kind: UploadKind, fileName: string): string {
  const allowed = EXTENSIONS[kind];
  const extension = fileName.toLowerCase().match(/\.([a-z0-9]{1,5})$/)?.[1];
  const chosen = extension && allowed.includes(extension) ? extension : allowed[0];
  return `uploads/${userId}/${crypto.randomUUID()}.${chosen}`;
}

function failed(): Response {
  return new Response(null, { status: 502 });
}

async function sendToBlob(
  url: string,
  method: string,
  fields: Record<string, string>,
  parts: readonly UploadPart[],
  onProgress: (percent: number) => void,
): Promise<Response> {
  const total = parts.reduce((sum, part) => sum + part.file.size, 0) || 1;
  const body: Record<string, string | UploadRef> = { ...fields };
  let doneBytes = 0;
  try {
    const userId = await currentUserId();
    for (const part of parts) {
      const stored = await upload(uploadPath(userId, part.kind, part.file.name), part.file, {
        access: "private",
        handleUploadUrl: "/api/uploads/token",
        clientPayload: JSON.stringify({ kind: part.kind }),
        onUploadProgress: (event) =>
          onProgress(Math.floor(((doneBytes + event.loaded) / total) * 100)),
      });
      doneBytes += part.file.size;
      body[part.name] = { key: stored.pathname, fileName: part.file.name };
    }
  } catch {
    return failed();
  }
  return fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(failed);
}

function sendAsForm(
  url: string,
  method: string,
  fields: Record<string, string>,
  parts: readonly UploadPart[],
  onProgress: (percent: number) => void,
): Promise<Response> {
  return new Promise((resolve) => {
    const request = new XMLHttpRequest();
    request.open(method, url);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.floor((event.loaded / event.total) * 100));
    };
    request.onload = () =>
      resolve(
        new Response(request.status === 204 ? null : request.responseText, {
          status: request.status,
          headers: { "Content-Type": request.getResponseHeader("Content-Type") ?? "text/plain" },
        }),
      );
    request.onerror = () => resolve(failed());
    request.onabort = () => resolve(failed());
    const body = new FormData();
    for (const [name, value] of Object.entries(fields)) body.append(name, value);
    for (const part of parts) body.append(part.name, part.file);
    request.send(body);
  });
}

export function sendWithFiles(
  url: string,
  method: "POST" | "PUT",
  fields: Record<string, string>,
  parts: readonly UploadPart[],
  onProgress: (percent: number) => void = () => {},
): Promise<Response> {
  return USES_BLOB
    ? sendToBlob(url, method, fields, parts, onProgress)
    : sendAsForm(url, method, fields, parts, onProgress);
}
