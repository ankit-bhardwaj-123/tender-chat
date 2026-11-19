import { z } from "zod";

export const CreateTenderBody = z.object({ name: z.string().optional() });

export const UpdateTenderBody = z.object({
  name: z.string().optional(),
  companyId: z.uuid().nullable().optional(),
  templateId: z.uuid().nullable().optional(),
  values: z.record(z.string(), z.string()).optional(),
});
