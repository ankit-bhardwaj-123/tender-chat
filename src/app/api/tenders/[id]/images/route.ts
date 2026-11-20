import { handle, parseId, readUploads } from "@/server/http";
import { requireUserId } from "@/server/session";
import { saveTenderImage } from "@/services/tender-image.service";
import { receiveUpload } from "@/services/upload.service";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const userId = await requireUserId(request);
    const tenderId = parseId(id, "Tender not found.");
    const { files } = await readUploads(request, { file: "The form has no file." });
    const upload = await receiveUpload(userId, "tenderImage", files.file);
    const image = await saveTenderImage(userId, tenderId, upload);
    return Response.json(image, { status: 201 });
  });
}
