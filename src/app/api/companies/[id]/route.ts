import { handle, parseId, readJson } from "@/server/http";
import { requireUserId } from "@/server/session";
import { deleteCompany, getCompany, renameCompany } from "@/services/company.service";
import { CompanyBody } from "@/shared/company-body";

const NOT_FOUND = "Company not found.";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const userId = await requireUserId(request);
    return Response.json(await getCompany(userId, parseId(id, NOT_FOUND)));
  });
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const userId = await requireUserId(request);
    const companyId = parseId(id, NOT_FOUND);
    const body = await readJson(request, CompanyBody);
    return Response.json(await renameCompany(userId, companyId, body.name));
  });
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const userId = await requireUserId(request);
    await deleteCompany(userId, parseId(id, NOT_FOUND));
    return new Response(null, { status: 204 });
  });
}
