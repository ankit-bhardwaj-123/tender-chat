import { z } from "zod";
import { MAX_TOP_MM } from "@/shared/canvas";

export const PdfBody = z.object({
  sealTop: z.number().min(0).max(MAX_TOP_MM).nullable(),
});
