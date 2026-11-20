import { cleanPlaceholderName, PLACEHOLDER } from "@/shared/placeholders";

export interface FillOptions {
  mark: boolean;
  fontCss: string;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function valueHtml(value: string): string {
  return escapeHtml(value).replace(/\r?\n/g, "<br>");
}

export const TEMPLATE_TAG = "data-tpl";

const TAG = /<[a-z][^\s/>]*(?:"[^"]*"|'[^']*'|[^'">])*>/gi;
const HAS_PLACEHOLDER = /\{\{[^{}]*\}\}/;
const META_REFRESH = /<meta\b[^>]*http-equiv\s*=\s*["']?\s*refresh[^>]*>/gi;
const EVENT_ATTRIBUTE = /\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;

export function stripScripts(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<script\b[^>]*\/?>/gi, "")
    .replace(META_REFRESH, "")
    .replace(TAG, (tag) => tag.replace(EVENT_ATTRIBUTE, ""));
}

function tagRanges(html: string): [number, number][] {
  return Array.from(html.matchAll(TAG), (match) => [match.index, match.index + match[0].length]);
}

function markedTag(tag: string): string {
  const original = escapeHtml(tag).replaceAll("{", "&#123;").replaceAll("}", "&#125;");
  return tag.replace(/\s*\/?>$/, (end) => ` ${TEMPLATE_TAG}="${original}"${end}`);
}

function withTagMarkers(html: string, start: number): string {
  return html.replace(TAG, (tag: string, offset: number) =>
    offset >= start && HAS_PLACEHOLDER.test(tag) ? markedTag(tag) : tag,
  );
}

function bodyStart(html: string): number {
  const body = /<body\b[^>]*>/i.exec(html);
  if (body) return body.index + body[0].length;
  const head = /<\/head\s*>/i.exec(html);
  return head ? head.index + head[0].length : 0;
}

function markedHtml(name: string, value: string): string {
  const field = escapeHtml(name);
  if (value === "") return `<span data-field="${field}" data-empty="">${field}</span>`;
  return `<span data-field="${field}">${valueHtml(value)}</span>`;
}

export function withHeadEnd(html: string, css: string): string {
  if (css === "") return html;
  const style = `<style data-font="">${css}</style>`;
  const close = /<\/head\s*>/i.exec(html);
  if (!close) return style + html;
  return html.slice(0, close.index) + style + html.slice(close.index);
}

export function fontOverrideCss(fontStack: string, fontFaces: string): string {
  return `${fontFaces}\n:root,:root body,:root body *{font-family:${fontStack} !important}`;
}

export function fillTemplate(
  html: string,
  values: Record<string, string>,
  options: FillOptions,
): string {
  const stripped = stripScripts(html);
  const start = options.mark ? bodyStart(stripped) : 0;
  const clean = options.mark ? withTagMarkers(stripped, start) : stripped;
  const tags = options.mark ? tagRanges(clean) : [];
  const filled = clean.replace(PLACEHOLDER, (match: string, raw: string, offset: number) => {
    const name = cleanPlaceholderName(raw);
    if (name === "") return match;
    const value = values[name] ?? "";
    if (!options.mark || offset < start) return valueHtml(value);
    const insideTag = tags.some(([from, to]) => offset > from && offset < to);
    return insideTag ? escapeHtml(value) : markedHtml(name, value);
  });
  return withHeadEnd(filled, options.fontCss);
}
