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

export function stripScripts(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<script\b[^>]*\/?>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
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

export function withHeadStart(html: string, css: string): string {
  if (css === "") return html;
  const style = `<style data-font="">${css}</style>`;
  const head = /<head\b[^>]*>/i.exec(html);
  if (!head) return style + html;
  const at = head.index + head[0].length;
  return html.slice(0, at) + style + html.slice(at);
}

export function fontOverrideCss(fontStack: string, fontFaces: string): string {
  return `${fontFaces}\nhtml,body,body *{font-family:${fontStack} !important}`;
}

export function fillTemplate(
  html: string,
  values: Record<string, string>,
  options: FillOptions,
): string {
  const clean = stripScripts(html);
  const start = options.mark ? bodyStart(clean) : 0;
  const filled = clean.replace(PLACEHOLDER, (match: string, raw: string, offset: number) => {
    const name = cleanPlaceholderName(raw);
    if (name === "") return match;
    const value = values[name] ?? "";
    if (!options.mark || offset < start) return valueHtml(value);
    const before = clean.slice(0, offset);
    const insideTag = before.lastIndexOf("<") > before.lastIndexOf(">");
    return insideTag ? escapeHtml(value) : markedHtml(name, value);
  });
  return withHeadStart(filled, options.fontCss);
}
