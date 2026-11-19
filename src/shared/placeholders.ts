export const PLACEHOLDER = /\{\{([^{}]*)\}\}/g;

export function cleanPlaceholderName(raw: string): string {
  return raw.normalize("NFC").replace(/\s+/g, " ").trim();
}

export function findPlaceholders(html: string): string[] {
  const names: string[] = [];
  for (const match of html.matchAll(PLACEHOLDER)) {
    const name = cleanPlaceholderName(match[1] ?? "");
    if (name !== "" && !names.includes(name)) names.push(name);
  }
  return names;
}
