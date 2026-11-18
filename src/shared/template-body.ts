import { z } from "zod";

export const TEMPLATE_NAME_MAX_LENGTH = 200;
export const TEMPLATE_LANGUAGES = ["hi", "en"] as const;

const TemplateName = z
  .string()
  .transform((value) => value.normalize("NFC").replace(/\s+/g, " ").trim())
  .pipe(z.string().min(1).max(TEMPLATE_NAME_MAX_LENGTH));

const TemplateLanguage = z.enum(TEMPLATE_LANGUAGES);

export const NewTemplateBody = z.object({
  name: TemplateName,
  language: TemplateLanguage,
});

export const EditTemplateBody = z.object({
  name: TemplateName.optional(),
  language: TemplateLanguage.optional(),
});
