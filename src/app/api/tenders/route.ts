import { handle, readJson } from "@/server/http";
import { requireUserId } from "@/server/session";
import { createTenderItem, listTenders } from "@/services/tender.service";
import { CreateTenderBody } from "@/shared/tender-body";

export async function GET(request: Request) {
  return handle(async () => {
    const userId = await requireUserId(request);
    const search = new URL(request.url).searchParams.get("search") ?? "";
    const tenders = await listTenders(userId, search);
    return Response.json(tenders);
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const userId = await requireUserId(request);
    const body = await readJson(request, CreateTenderBody);
    const tender = await createTenderItem(userId, body.name);
    return Response.json(tender, { status: 201 });
  });
}
