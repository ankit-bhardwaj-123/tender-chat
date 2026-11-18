import { handle, parseId, readJson } from "@/server/http";
import { requireUserId } from "@/server/session";
import { deleteTemplate, editTemplate, getTemplate } from "@/services/template.service";
import { EditTemplateBody } from "@/shared/template-body";

const NOT_FOUND = "Template not found.";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const userId = await requireUserId(request);
    return Response.json(await getTemplate(userId, parseId(id, NOT_FOUND)));
  });
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const userId = await requireUserId(request);
    const templateId = parseId(id, NOT_FOUND);
    const body = await readJson(request, EditTemplateBody);
    return Response.json(await editTemplate(userId, templateId, body));
  });
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const userId = await requireUserId(request);
    await deleteTemplate(userId, parseId(id, NOT_FOUND));
    return new Response(null, { status: 204 });
  });
}
