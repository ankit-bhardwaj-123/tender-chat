import { type HandleUploadBody, handleUpload } from "@vercel/blob/client";
import { env } from "@/server/env";
import { invalid, notFound } from "@/server/errors";
import { handle } from "@/server/http";
import { requireUserId } from "@/server/session";
import { checkUploadPath } from "@/services/upload.service";

function readKind(clientPayload: string | null): unknown {
  try {
    return (JSON.parse(clientPayload ?? "null") as { kind?: unknown } | null)?.kind;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  return handle(async () => {
    const userId = await requireUserId(request);
    if (env.NEXT_PUBLIC_FILE_STORE !== "blob") {
      throw notFound("Blob uploads are off.");
    }
    const body = (await request.json().catch(() => null)) as HandleUploadBody | null;
    if (body?.type !== "blob.generate-client-token") {
      throw invalid("The request body is not valid.");
    }
    const result = await handleUpload({
      body,
      request,
      token: env.BLOB_READ_WRITE_TOKEN,
      onBeforeGenerateToken: async (pathname, clientPayload) => ({
        ...checkUploadPath(userId, readKind(clientPayload), pathname),
        addRandomSuffix: false,
        allowOverwrite: false,
      }),
    });
    return Response.json(result);
  });
}
