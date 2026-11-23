import { notFound } from "@/server/errors";
import { encodeFileName, handle, parseId } from "@/server/http";
import { requireUserId } from "@/server/session";
import { openSavedPdfPart } from "@/services/saved-pdf.service";

interface PartParams {
  params: Promise<{ id: string; pdfId: string; kind: string }>;
}

const NOT_FOUND = "This PDF can't be found.";

export async function GET(request: Request, ctx: PartParams) {
  return handle(async () => {
    const { id, pdfId, kind } = await ctx.params;
    const userId = await requireUserId(request);
    if (kind !== "letterhead" && kind !== "seal") throw notFound(NOT_FOUND);
    const { fileName, contentType, size, file } = await openSavedPdfPart(
      userId,
      parseId(id, NOT_FOUND),
      parseId(pdfId, NOT_FOUND),
      kind,
    );
    return new Response(file, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(size),
        "Content-Disposition": `inline; filename*=UTF-8''${encodeFileName(fileName)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
