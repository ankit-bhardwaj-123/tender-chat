import { encodeFileName, handle, parseId, readJson } from "@/server/http";
import { requireUserId } from "@/server/session";
import { makeTenderPdf } from "@/services/tender-pdf.service";
import { PdfBody } from "@/shared/pdf-body";

interface TenderParams {
  params: Promise<{ id: string }>;
}

export const maxDuration = 60;

export async function POST(request: Request, ctx: TenderParams) {
  return handle(async () => {
    const { id } = await ctx.params;
    const userId = await requireUserId(request);
    const tenderId = parseId(id, "Tender not found.");
    const { sealTop } = await readJson(request, PdfBody);
    const { fileName, bytes } = await makeTenderPdf(userId, tenderId, sealTop);
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeFileName(fileName)}`,
        "Cache-Control": "private, no-store",
      },
    });
  });
}
