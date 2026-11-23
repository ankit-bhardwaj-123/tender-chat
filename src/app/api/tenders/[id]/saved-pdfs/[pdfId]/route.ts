import { encodeFileName, handle, parseId, readJson } from "@/server/http";
import { requireUserId } from "@/server/session";
import { openSavedPdf, replaceTenderPdf } from "@/services/saved-pdf.service";
import { SavePdfBody } from "@/shared/pdf-body";

interface SavedPdfParams {
  params: Promise<{ id: string; pdfId: string }>;
}

const NOT_FOUND = "This PDF can't be found.";

export const maxDuration = 60;

export async function GET(request: Request, ctx: SavedPdfParams) {
  return handle(async () => {
    const { id, pdfId } = await ctx.params;
    const userId = await requireUserId(request);
    const { fileName, contentType, size, file } = await openSavedPdf(
      userId,
      parseId(id, NOT_FOUND),
      parseId(pdfId, NOT_FOUND),
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

export async function PUT(request: Request, ctx: SavedPdfParams) {
  return handle(async () => {
    const { id, pdfId } = await ctx.params;
    const userId = await requireUserId(request);
    const tenderId = parseId(id, NOT_FOUND);
    const savedId = parseId(pdfId, NOT_FOUND);
    const { sealTop, name } = await readJson(request, SavePdfBody);
    const saved = await replaceTenderPdf(userId, tenderId, savedId, sealTop, name);
    return Response.json(saved);
  });
}
