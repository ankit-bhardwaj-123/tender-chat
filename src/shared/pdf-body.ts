import { z } from "zod";
import { MAX_TOP_MM } from "@/shared/canvas";

export const PdfBody = z.object({
  sealTop: z.number().min(0).max(MAX_TOP_MM).nullable(),
});

export const SavePdfBody = z.object({
  sealTop: z.number().min(0).max(MAX_TOP_MM).nullable(),
  name: z.string().optional(),
});

export const SAVE_FAILED = "PDF generated but failed to save. Please try again.";
