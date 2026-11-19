import { z } from "zod";
import { isAppError, invalid, notFound } from "./errors";
import type { UploadRef } from "@/types";
import { reportError } from "./report-error";

export async function handle(work: () => Promise<Response>): Promise<Response> {
  try {
    return await work();
  } catch (error) {
    if (isAppError(error)) {
      switch (error.kind) {
        case "unauthorized":
          return Response.json({ error: { message: error.message } }, { status: 401 });
        case "not_found":
          return Response.json({ error: { message: error.message } }, { status: 404 });
        case "invalid":
          return Response.json({ error: { message: error.message } }, { status: 400 });
        case "unavailable":
          reportError(error);
          return Response.json({ error: { message: error.message } }, { status: 500 });
      }
    }
    reportError(error);
    return Response.json(
      { error: { message: "Something went wrong. Please try again." } },
      { status: 500 },
    );
  }
}

export async function readJson<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  const json: unknown = await request.json().catch(() => {
    throw invalid("The request body must be JSON.");
  });
  const result = schema.safeParse(json);
  if (!result.success) {
    const custom = result.error.issues.find((issue) => issue.code === "custom");
    throw invalid(custom?.message ?? "The request body is not valid.");
  }
  return result.data;
}

export function parseId(id: string, notFoundMessage: string): string {
  if (!z.uuid().safeParse(id).success) {
    throw notFound(notFoundMessage);
  }
  return id;
}

export function encodeFileName(fileName: string): string {
  return encodeURIComponent(fileName).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

const UploadRefBody = z.object({ key: z.string().min(1).max(300), fileName: z.string() });

export interface UploadParts<Name extends string> {
  fields: Record<string, unknown>;
  files: Record<Name, File | UploadRef>;
}

export async function readUploads<Name extends string>(
  request: Request,
  missingMessages: Record<Name, string>,
): Promise<UploadParts<Name>> {
  const files: Partial<Record<Name, File | UploadRef>> = {};
  const names = Object.keys(missingMessages) as Name[];
  if (request.headers.get("content-type")?.includes("application/json")) {
    const json: unknown = await request.json().catch(() => {
      throw invalid("The request body must be JSON.");
    });
    if (typeof json !== "object" || json === null || Array.isArray(json)) {
      throw invalid("The request body is not valid.");
    }
    const fields = json as Record<string, unknown>;
    for (const name of names) {
      const ref = UploadRefBody.safeParse(fields[name]);
      if (!ref.success) throw invalid(missingMessages[name]);
      files[name] = ref.data;
    }
    return { fields, files: files as Record<Name, File | UploadRef> };
  }

  const form = await request.formData().catch(() => {
    throw invalid("The request must be a form with a file.");
  });
  const fields: Record<string, unknown> = {};
  for (const [name, value] of form.entries()) {
    if (typeof value === "string") fields[name] = value;
  }
  for (const name of names) {
    const value = form.get(name);
    if (!(value instanceof File)) throw invalid(missingMessages[name]);
    files[name] = value;
  }
  return { fields, files: files as Record<Name, File | UploadRef> };
}
