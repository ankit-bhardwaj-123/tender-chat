import type { Template, TemplateLanguage } from "@/types";
import { useQuery } from "@tanstack/react-query";
import { sendWithFiles } from "@/lib/file-upload";

export interface LanguageOption {
  value: TemplateLanguage;
  label: string;
}

export interface TemplateFields {
  name: string;
  language: TemplateLanguage;
}

export const TEMPLATES_KEY = ["templates"] as const;

export const LANGUAGES: readonly LanguageOption[] = [
  { value: "hi", label: "हिन्दी (Hindi)" },
  { value: "en", label: "English" },
];

const FAILED = "Something went wrong, please try again.";

export function languageLabel(language: TemplateLanguage): string {
  return language === "hi" ? "हिन्दी" : "English";
}

export function templateFileUrl(template: Template): string {
  return `/api/templates/${template.id}/file?v=${encodeURIComponent(template.updatedAt)}`;
}

async function failure(res: Response): Promise<Error> {
  if (res.status >= 500) return new Error(FAILED);
  const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
  return new Error(body?.error?.message ?? FAILED);
}

async function readTemplate(res: Response): Promise<Template> {
  if (!res.ok) throw await failure(res);
  return (await res.json()) as Template;
}

export async function fetchTemplates(): Promise<Template[]> {
  const res = await fetch("/api/templates");
  if (!res.ok) throw new Error("Couldn't load your templates.");
  return (await res.json()) as Template[];
}

export function useTemplates() {
  return useQuery({ queryKey: TEMPLATES_KEY, queryFn: fetchTemplates });
}

export async function createTemplate(fields: TemplateFields, file: File): Promise<Template> {
  const res = await sendWithFiles(
    "/api/templates",
    "POST",
    { name: fields.name, language: fields.language },
    [{ name: "file", kind: "template", file }],
  );
  return readTemplate(res);
}

export async function editTemplate(templateId: string, fields: TemplateFields): Promise<Template> {
  const res = await fetch(`/api/templates/${templateId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fields),
  });
  return readTemplate(res);
}

export async function replaceTemplateFile(templateId: string, file: File): Promise<Template> {
  const res = await sendWithFiles(`/api/templates/${templateId}/file`, "PUT", {}, [
    { name: "file", kind: "template", file },
  ]);
  return readTemplate(res);
}

export async function deleteTemplate(templateId: string): Promise<void> {
  const res = await fetch(`/api/templates/${templateId}`, { method: "DELETE" });
  if (!res.ok) throw await failure(res);
}
