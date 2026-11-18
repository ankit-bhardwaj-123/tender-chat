import {
  findTemplateById,
  findTemplatesByUser,
  insertTemplate,
  lockTemplate,
  type TemplateChanges,
  updateTemplate,
  voidTemplate,
} from "@/repositories/template.repository";
import { storage } from "@/server/adapters/file-storage";
import { db } from "@/server/adapters/postgres";
import { invalid, notFound } from "@/server/errors";
import { reportError } from "@/server/report-error";
import { toTemplate } from "@/shared/dto";
import { findPlaceholders } from "@/shared/placeholders";
import {
  discardUpload,
  readUploadBytes,
  UPLOAD_LIMITS,
  type UploadedFile,
} from "@/services/upload.service";
import type { Template, TemplateLanguage } from "@/types";

export interface NewTemplateFields {
  name: string;
  language: TemplateLanguage;
}

export interface TemplateEdits {
  name?: string;
  language?: TemplateLanguage;
}

interface CheckedHtml {
  fileName: string;
  placeholders: string[];
}

const NOT_FOUND = "Template not found.";
const HTML_NAME = /\.html?$/i;
const MAX_HTML_BYTES = UPLOAD_LIMITS.template.maxBytes;
const FILE_NAME_MAX_LENGTH = 200;

function cleanFileName(raw: string): string {
  const name = raw
    .normalize("NFC")
    .replace(/[\p{Cc}/\\]/gu, "")
    .trim();
  if (name === "") return "template.html";
  return name.length > FILE_NAME_MAX_LENGTH ? name.slice(-FILE_NAME_MAX_LENGTH) : name;
}

async function checkHtml(upload: UploadedFile): Promise<CheckedHtml> {
  if (!HTML_NAME.test(upload.fileName)) {
    throw invalid("Upload the layout as an HTML file (.html).");
  }
  if (upload.size === 0) {
    throw invalid("The HTML layout is empty.");
  }
  if (upload.size > MAX_HTML_BYTES) {
    throw invalid(`An HTML layout must be at most ${MAX_HTML_BYTES / 1024 / 1024} MB.`);
  }
  let html: string;
  try {
    html = new TextDecoder("utf-8", { fatal: true }).decode(await readUploadBytes(upload));
  } catch {
    throw invalid("Save the HTML layout as UTF-8 text.");
  }
  return { fileName: cleanFileName(upload.fileName), placeholders: findPlaceholders(html) };
}

async function removeStoredFile(storageKey: string): Promise<void> {
  await storage.delete(storageKey).catch((error: unknown) => reportError(error));
}

export async function listTemplates(userId: string): Promise<Template[]> {
  const rows = await findTemplatesByUser(userId);
  return rows.map(toTemplate);
}

export async function getTemplate(userId: string, templateId: string): Promise<Template> {
  const row = await findTemplateById(userId, templateId);
  if (!row) {
    throw notFound(NOT_FOUND);
  }
  return toTemplate(row);
}

export async function createTemplate(
  userId: string,
  fields: NewTemplateFields,
  upload: UploadedFile,
): Promise<Template> {
  try {
    const checked = await checkHtml(upload);
    const row = await insertTemplate(userId, {
      name: fields.name,
      language: fields.language,
      storageKey: upload.key,
      fileName: checked.fileName,
      sizeBytes: upload.size,
      placeholders: checked.placeholders,
    });
    return toTemplate(row);
  } catch (error) {
    await discardUpload(upload);
    throw error;
  }
}

export async function editTemplate(
  userId: string,
  templateId: string,
  edits: TemplateEdits,
): Promise<Template> {
  const changes: TemplateChanges = {};
  if (edits.name !== undefined) changes.name = edits.name;
  if (edits.language !== undefined) changes.language = edits.language;
  const row = await updateTemplate(userId, templateId, changes);
  if (!row) {
    throw notFound(NOT_FOUND);
  }
  return toTemplate(row);
}

export async function replaceTemplateFile(
  userId: string,
  templateId: string,
  upload: UploadedFile,
): Promise<Template> {
  let previousKey: string | null = null;
  let updated: Template;
  try {
    if (!(await findTemplateById(userId, templateId))) {
      throw notFound(NOT_FOUND);
    }
    const checked = await checkHtml(upload);
    updated = await db.transaction(async (tx) => {
      const locked = await lockTemplate(userId, templateId, tx);
      if (!locked) {
        throw notFound(NOT_FOUND);
      }
      previousKey = locked.storageKey;
      const row = await updateTemplate(
        userId,
        templateId,
        {
          storageKey: upload.key,
          fileName: checked.fileName,
          sizeBytes: upload.size,
          placeholders: checked.placeholders,
        },
        tx,
      );
      if (!row) {
        throw notFound(NOT_FOUND);
      }
      return toTemplate(row);
    });
  } catch (error) {
    await discardUpload(upload);
    throw error;
  }

  if (previousKey) await removeStoredFile(previousKey);
  return updated;
}

export async function openTemplateFile(userId: string, templateId: string): Promise<string> {
  const row = await findTemplateById(userId, templateId);
  if (!row) {
    throw notFound(NOT_FOUND);
  }
  return (await storage.open(row.storageKey)).text();
}

export async function deleteTemplate(userId: string, templateId: string): Promise<void> {
  const voided = await voidTemplate(userId, templateId);
  if (!voided) {
    throw notFound(NOT_FOUND);
  }
}
