import { handle, parseId, readJson } from "@/server/http";
import { requireUserId } from "@/server/session";
import { listSavedPdfs, saveTenderPdf } from "@/services/saved-pdf.service";
import { SavePdfBody } from "@/shared/pdf-body";

interface TenderParams {
  params: Promise<{ id: string }>;
}

const NOT_FOUND = "Tender not found.";

export const maxDuration = 60;

export async function GET(request: Request, ctx: TenderParams) {
  return handle(async () => {
    const { id } = await ctx.params;
    const userId = await requireUserId(request);
    const pdfs = await listSavedPdfs(userId, parseId(id, NOT_FOUND));
    return Response.json(pdfs);
  });
}

export async function POST(request: Request, ctx: TenderParams) {
  return handle(async () => {
    const { id } = await ctx.params;
    const userId = await requireUserId(request);
    const tenderId = parseId(id, NOT_FOUND);
    const { sealTop, name } = await readJson(request, SavePdfBody);
    const saved = await saveTenderPdf(userId, tenderId, sealTop, name);
    return Response.json(saved, { status: 201 });
  });
}
