import { z } from "zod";
import { CanvasBody } from "@/shared/canvas";

export const CreateTenderBody = z.object({
  name: z.string().optional(),
  parentId: z.uuid().optional(),
  subfolderName: z.string().optional(),
});

export const UpdateTenderBody = z.object({
  name: z.string().optional(),
  parentId: z.uuid().nullable().optional(),
  editingPdfId: z.null().optional(),
  companyId: z.uuid().nullable().optional(),
  templateId: z.uuid().nullable().optional(),
  values: z.record(z.string(), z.string()).optional(),
  customHtml: z.string().nullable().optional(),
  canvas: CanvasBody.optional(),
});
