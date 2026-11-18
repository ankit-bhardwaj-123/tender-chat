import { notFound } from "@/server/errors";
import { encodeFileName, handle, parseId, readUploads } from "@/server/http";
import { requireUserId } from "@/server/session";
import {
  isCompanyFileKind,
  openCompanyFile,
  removeCompanyFile,
  uploadCompanyFile,
} from "@/services/company.service";
import { receiveUpload } from "@/services/upload.service";
import type { CompanyFileKind } from "@/types";

interface FileParams {
  params: Promise<{ id: string; kind: string }>;
}

interface FileTarget {
  companyId: string;
  kind: CompanyFileKind;
}

async function readTarget(ctx: FileParams): Promise<FileTarget> {
  const { id, kind } = await ctx.params;
  const companyId = parseId(id, "Company not found.");
  if (!isCompanyFileKind(kind)) {
    throw notFound("File not found.");
  }
  return { companyId, kind };
}

export async function GET(request: Request, ctx: FileParams) {
  return handle(async () => {
    const userId = await requireUserId(request);
    const { companyId, kind } = await readTarget(ctx);
    const { fileName, contentType, size, file } = await openCompanyFile(userId, companyId, kind);
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

export async function PUT(request: Request, ctx: FileParams) {
  return handle(async () => {
    const userId = await requireUserId(request);
    const { companyId, kind } = await readTarget(ctx);
    const { files } = await readUploads(request, { file: "The form has no file." });
    const upload = await receiveUpload(userId, "companyFile", files.file);
    return Response.json(await uploadCompanyFile(userId, companyId, kind, upload));
  });
}

export async function DELETE(request: Request, ctx: FileParams) {
  return handle(async () => {
    const userId = await requireUserId(request);
    const { companyId, kind } = await readTarget(ctx);
    return Response.json(await removeCompanyFile(userId, companyId, kind));
  });
}
