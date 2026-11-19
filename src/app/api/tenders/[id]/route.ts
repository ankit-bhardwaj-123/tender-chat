import { handle, parseId, readJson } from "@/server/http";
import { requireUserId } from "@/server/session";
import { deleteTender, getTender, updateTender } from "@/services/tender.service";
import { UpdateTenderBody } from "@/shared/tender-body";

const NOT_FOUND = "Tender not found.";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const userId = await requireUserId(request);
    const tender = await getTender(userId, parseId(id, NOT_FOUND));
    return Response.json(tender);
  });
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const userId = await requireUserId(request);
    const tenderId = parseId(id, NOT_FOUND);
    const body = await readJson(request, UpdateTenderBody);
    const tender = await updateTender(userId, tenderId, body);
    return Response.json(tender);
  });
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const userId = await requireUserId(request);
    await deleteTender(userId, parseId(id, NOT_FOUND));
    return new Response(null, { status: 204 });
  });
}
