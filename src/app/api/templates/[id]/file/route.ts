import { handle, parseId, readUploads } from "@/server/http";
import { requireUserId } from "@/server/session";
import { openTemplateFile, replaceTemplateFile } from "@/services/template.service";
import { receiveUpload } from "@/services/upload.service";

const NOT_FOUND = "Template not found.";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const userId = await requireUserId(request);
    const html = await openTemplateFile(userId, parseId(id, NOT_FOUND));
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy": "sandbox",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const userId = await requireUserId(request);
    const templateId = parseId(id, NOT_FOUND);
    const { files } = await readUploads(request, { file: "The form has no file." });
    const upload = await receiveUpload(userId, "template", files.file);
    return Response.json(await replaceTemplateFile(userId, templateId, upload));
  });
}
