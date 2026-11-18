import { invalid } from "@/server/errors";
import { handle, readUploads } from "@/server/http";
import { requireUserId } from "@/server/session";
import { createTemplate, listTemplates } from "@/services/template.service";
import { receiveUpload } from "@/services/upload.service";
import { NewTemplateBody } from "@/shared/template-body";

export async function GET(request: Request) {
  return handle(async () => {
    const userId = await requireUserId(request);
    return Response.json(await listTemplates(userId));
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const userId = await requireUserId(request);
    const { fields, files } = await readUploads(request, {
      file: "Add the HTML layout of the template.",
    });
    const body = NewTemplateBody.safeParse({
      name: fields.name ?? "",
      language: fields.language ?? "hi",
    });
    if (!body.success) {
      throw invalid("The template details are not valid.");
    }
    const upload = await receiveUpload(userId, "template", files.file);
    return Response.json(await createTemplate(userId, body.data, upload), { status: 201 });
  });
}
