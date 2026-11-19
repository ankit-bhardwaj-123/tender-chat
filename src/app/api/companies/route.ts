import { handle, readJson } from "@/server/http";
import { requireUserId } from "@/server/session";
import { createCompany, listCompanies } from "@/services/company.service";
import { CompanyBody } from "@/shared/company-body";

export async function GET(request: Request) {
  return handle(async () => {
    const userId = await requireUserId(request);
    return Response.json(await listCompanies(userId));
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const userId = await requireUserId(request);
    const body = await readJson(request, CompanyBody);
    return Response.json(await createCompany(userId, body.name, body.fontKey ?? null), {
      status: 201,
    });
  });
}
