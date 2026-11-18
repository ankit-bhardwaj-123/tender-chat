import { z } from "zod";
import { isAppError, invalid, notFound } from "./errors";
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
    throw invalid("The request body is not valid.");
  }
  return result.data;
}

export function parseId(id: string, notFoundMessage: string): string {
  if (!z.uuid().safeParse(id).success) {
    throw notFound(notFoundMessage);
  }
  return id;
}
