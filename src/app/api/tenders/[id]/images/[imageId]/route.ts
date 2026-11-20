import { encodeFileName, handle, parseId } from "@/server/http";
import { requireUserId } from "@/server/session";
import { openTenderImage, removeTenderImage } from "@/services/tender-image.service";

interface ImageParams {
  params: Promise<{ id: string; imageId: string }>;
}

const NOT_FOUND = "Image not found.";

export async function GET(request: Request, ctx: ImageParams) {
  return handle(async () => {
    const { id, imageId } = await ctx.params;
    const userId = await requireUserId(request);
    const { fileName, contentType, size, file } = await openTenderImage(
      userId,
      parseId(id, NOT_FOUND),
      parseId(imageId, NOT_FOUND),
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

export async function DELETE(request: Request, ctx: ImageParams) {
  return handle(async () => {
    const { id, imageId } = await ctx.params;
    const userId = await requireUserId(request);
    await removeTenderImage(userId, parseId(id, NOT_FOUND), parseId(imageId, NOT_FOUND));
    return new Response(null, { status: 204 });
  });
}
