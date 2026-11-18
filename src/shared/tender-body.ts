import { z } from "zod";

export const CreateTenderBody = z.object({ name: z.string().optional() });

export const RenameTenderBody = z.object({ name: z.string() });
