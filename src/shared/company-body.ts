import { z } from "zod";

export const COMPANY_NAME_MAX_LENGTH = 200;

export const CompanyBody = z.object({
  name: z
    .string()
    .transform((value) => value.normalize("NFC").replace(/\s+/g, " ").trim())
    .pipe(z.string().min(1).max(COMPANY_NAME_MAX_LENGTH)),
});
