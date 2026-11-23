import { handle, parseId } from "@/server/http";
import { requireUserId } from "@/server/session";
import { editSavedPdf } from "@/services/saved-pdf.service";

interface SavedPdfParams {
  params: Promise<{ id: string; pdfId: string }>;
}

const NOT_FOUND = "This PDF can't be found.";

export async function POST(request: Request, ctx: SavedPdfParams) {
  return handle(async () => {
    const { id, pdfId } = await ctx.params;
    const userId = await requireUserId(request);
    const tender = await editSavedPdf(userId, parseId(id, NOT_FOUND), parseId(pdfId, NOT_FOUND));
    return Response.json(tender);
  });
}
